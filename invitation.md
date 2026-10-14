# Lake Quals invitation chain

## Goal

- Selected teams get a **token**.
- Anyone holding a valid token can fill a form on a new **Lake Quals invitation** tab with **team name + email** to invite another team.
- Each submission is posted to Discord with **Accept / Reject buttons**.
- On **Accept**, the invited team gets an email with **its own token**, and it can then invite more teams.
- A token works **any number of times** until an admin **revokes** it.
- The DB keeps **who invited whom** so admins can see the whole tree.

**Out of scope: rCTF registration.** The Lake Quals rCTF instance doesn't exist yet. For now a token's only use is inviting more teams; it doesn't create an rCTF account or let anyone register. The accepted rows (team name + email) are the list of invited teams, and how they'll get into the CTF gets decided once the instance exists.

## Where the code goes

| Piece | Repo | Why |
|---|---|---|
| Table, endpoints, Discord, email | `friday-extras-backend` | It already has its own DB, admin auth (`require_admin`) and Discord code. |
| Public tab + admin view | `friday-frontend` | One new page and one new admin tab. |

rCTF and the existing `polygl0ts-bot` stay unchanged.

## Data model: one table

`app/models.py`:

```python
class InviteStatus(str, Enum):
    pending = "pending"     # waiting for a click in Discord
    accepted = "accepted"   # has a token, can invite
    rejected = "rejected"


class Invite(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    team_name: str
    email: str
    status: InviteStatus = Field(default=InviteStatus.pending, index=True)
    # Set on accept. NULL while pending/rejected.
    token: Optional[str] = Field(default=None, unique=True, index=True)
    revoked: bool = False
    # Who invited this team. NULL = a root team we seeded ourselves.
    invited_by_id: Optional[int] = Field(default=None, foreign_key="invite.id")
    created_at: datetime = Field(default_factory=_utcnow, sa_column=_utc_column())
    decided_by: Optional[str] = None   # Discord username who clicked
    decided_at: Optional[datetime] = Field(default=None, sa_column=_utc_column(nullable=True))
```

- **Token valid** ⇔ `status == accepted and not revoked`. Nothing else counts.
- Token = `secrets.token_urlsafe(24)`, stored in plain text so an admin can look one up and resend it.
- A root team is just a row with `invited_by_id = NULL`, created directly as `accepted`. The API reports its inviter as `"LakeOrga"`, so `invited_by` is never empty; the DB keeps `NULL`, which is what "no inviter" means to a foreign key.
- The tree view comes from `invited_by_id`. No extra table is needed.
- `create_all()` creates the new table at startup. No migration entry is needed.

## Backend: `app/routers/invites.py`

Public endpoints (no rCTF login; the invite token *is* the auth):

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/invites/whoami?token=…` | `200 {team_name}` if the token is valid, otherwise `404`. The frontend uses this to unlock the form. |
| `POST` | `/api/invites` `{token, team_name, email}` | Checks the token (`403` if invalid), validates the input (`422` if bad), inserts a `pending` row with `invited_by_id = inviter.id`, posts the Discord message, returns `204`. |

Input limits, as Pydantic `Field` constraints on the request body. They apply to both the public endpoint and "create root":

- `team_name`: stripped, 1–100 chars, no control characters (a newline would let a name fake extra lines in the Discord message).
- `email`: stripped, at most 254 chars, must match `^[^@\s,;<>"]+@[^@\s,;<>"]+$` (one address, never a list). That catches typos without adding the `email-validator` dependency; whether the address really works shows when the email arrives.
- Besides keeping junk out of the DB, these limits keep the Discord message well under its 2000-character cap.

Admin endpoints (`require_admin`, same as `app/routers/admin.py`):

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/admin/invites` | All rows, each with its inviter's `team_name` resolved and its `token`. Used for the admin table. |
| `POST` | `/api/admin/invites` `{team_name, email}` | Creates a **root** team: `accepted`, new token, sends the email. This is how the first set of teams is seeded. |
| `POST` | `/api/admin/invites/{id}/accept` | Same `accept()` as the Discord button. Fallback for when Discord is down. `409` if not `pending`. |
| `POST` | `/api/admin/invites/{id}/reject` | `status = rejected`. `409` if not `pending`. |
| `POST` | `/api/admin/invites/{id}/revoke` | `revoked = True`. |

Discord callback (see below):

| Method | Path | Does |
|---|---|---|
| `POST` | `/api/discord/interactions` | Receives button clicks from Discord. |

Shared helpers `accept(id, decided_by) -> Invite | None` and `reject(id, decided_by) -> Invite | None`:

- Each one is a single conditional `UPDATE`, so two clicks at the same moment (two Discord admins, or Discord and the admin page) can't both win:

  ```python
  result = session.exec(
      update(Invite)
      .where(Invite.id == id, Invite.status == InviteStatus.pending)
      .values(status=InviteStatus.accepted, token=secrets.token_urlsafe(24),
              decided_by=decided_by, decided_at=_utcnow())
  )
  session.commit()
  if result.rowcount != 1:
      return None
  return session.get(Invite, id)
  ```

  `reject` is the same with `status=rejected` and no token.
- `None` means the row wasn't `pending` (already decided, or missing). The caller answers `409`, or in Discord shows the current state, and sends **no** email.
- `accept` doesn't send the email itself. Only when it returns the invite does the caller queue the send with `BackgroundTasks` (see Email).

The Discord buttons, the admin accept/reject endpoints and "create root" all call these, so the code exists once. "Create root" inserts a `pending` row with `invited_by_id = NULL` and immediately calls `accept`. `decided_by` is the Discord username or the admin's team name.

## Discord: buttons via HTTP interactions

**Chosen approach:** a message with two buttons, with clicks delivered to the backend over HTTP.

- **Why not reactions:** the backend would need a gateway bot (a websocket process that stays running).
- **Why not a slash command:** it needs the same endpoint as buttons, plus command registration, and admins would have to type IDs.
- **Why buttons:** stateless HTTP fits FastAPI as it is.

**One-time setup**

1. Create a **new** Discord application, "Lake Quals". Don't reuse `polygl0ts-bot`: setting an interactions URL on its application would take button events away from it.
2. Add the bot to the server and give it *Send Messages* in a private `#lake-quals-invites` channel. Only the people who can see that channel can click.
3. In the developer portal, set **Interactions Endpoint URL** to `https://<extras-origin>/api/discord/interactions`. Discord sends a PING to check it, so deploy the endpoint first.

**Posting** (in `POST /api/invites`, plain `httpx` like `discord.py` already does):

```
POST https://discord.com/api/v10/channels/{CHANNEL_ID}/messages
Authorization: Bot {BOT_TOKEN}
{
  "content": "**{inviter}** invites **{team_name}** ({email})",
  "allowed_mentions": {"parse": []},
  "components": [{"type": 1, "components": [
    {"type": 2, "style": 3, "label": "Accept", "custom_id": "invite:accept:{id}"},
    {"type": 2, "style": 4, "label": "Reject", "custom_id": "invite:reject:{id}"}
  ]}]
}
```

`allowed_mentions: {"parse": []}` turns off every ping. Without it, a team named `@everyone` or `<@&role-id>` would ping the whole server, since the team name is free text from the public form.

If Discord is down, keep the `pending` row anyway. An admin can accept or reject it later from the admin page.

If an admin decides on the site, the Discord message keeps its buttons. A later click there sees the row is no longer `pending` and only updates the message.

**Handling a click** (`POST /api/discord/interactions`):

1. Verify the signature using the headers `X-Signature-Ed25519` and `X-Signature-Timestamp` and the app's public key. Discord requires this: a bad signature must return `401`, or Discord refuses the endpoint. Use `PyNaCl` (`VerifyKey(pk).verify(ts + body, sig)`), which is the only new dependency. `body` must be the raw bytes from `await request.body()`, read before any JSON parsing: re-serialized JSON won't match the signature. So the endpoint takes a plain `Request`, not a Pydantic model.
2. `type == 1` (PING): return `{"type": 1}`.
3. `type == 3` (button):
   - Parse `custom_id` into `action, id`.
   - The clicker is `payload["member"]["user"]["username"]`. In a server channel Discord nests the user under `member`; the top-level `user` field is only set in DMs.
   - Accept → `accept(id, user)`. Reject → `reject(id, user)`.
   - If the helper returns `None`, someone already decided (another click, or an admin on the site). Load the row and answer with its current state.
   - Return `{"type": 7, "data": {"content": "<original> — ✅ accepted by {user}", "components": []}}`. Type 7 edits the message in place and removes the buttons. Two clicks can still arrive at the same moment, before the buttons disappear; the conditional `UPDATE` in the helpers makes sure only one of them wins.
   - Discord expects a reply within **3 s**. Send the email with FastAPI's `BackgroundTasks` so a slow SMTP server can't cause a timeout.

## Email: stdlib `smtplib`

There's no new library. Reuse the SMTP account rCTF already uses (`rctf_mail_host` = `ssl0.ovh.net`, `rctf_mail_port` = `587`, `rctf_mail_user` = `no-reply@polygl0ts.ch` and its password in the infra vault, see `infra/ansible/roles/rctf-docker/defaults/main.yaml`). Port 587 means plain SMTP upgraded with STARTTLS, not `SMTP_SSL`.

`smtplib` blocks, so every caller runs the send through FastAPI's `BackgroundTasks` (it runs sync functions in a thread pool). This applies to the admin endpoints too, not only the Discord click.

If a send fails, the token still exists. The admin table's copy-link button is the resend path.

```python
msg = EmailMessage()
msg["From"], msg["To"], msg["Subject"] = settings.smtp_from, invite.email, "Lake Quals invitation"
msg.set_content(f"""Your team {invite.team_name} has been invited to Lake Quals.

Your invite token: {invite.token}
Use it to invite other teams: {settings.web_origin}/lake-quals?token={invite.token}
""")
with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as s:
    s.starttls()
    s.login(settings.smtp_user, settings.smtp_password)
    s.send_message(msg)
```

## Config: new `EXTRAS_*` env vars

`app/config.py`, `compose.yaml`, and the `friday-extras-backend-docker` Ansible role (secrets go in the vault):

```
EXTRAS_DISCORD_BOT_TOKEN
EXTRAS_DISCORD_PUBLIC_KEY
EXTRAS_DISCORD_INVITE_CHANNEL_ID
EXTRAS_SMTP_HOST / _PORT / _USER / _PASSWORD / _FROM
```

`EXTRAS_WEB_ORIGIN` already exists and builds the link in the email.

Each feature degrades on its own when unset: without the bot token or channel, invites are stored but not posted; without `SMTP_HOST`, nothing is emailed and the admin copies the link by hand; without the public key, every interaction is refused with `401`.

In the Ansible role the variables are `lake_quals_discord_*` and `friday_extras_backend_smtp_*`. The SMTP host, port and user default to rCTF's mailbox, and `EXTRAS_SMTP_FROM` reuses the user.

## Frontend

1. **Public tab.** In `Header.tsx` `NAV_ITEMS`, add `{ to: "/lake-quals", label: "lake quals" }`. Add the route in `App.tsx`.
2. **`src/pages/LakeQuals.tsx`.**
   - A token input, pre-filled from `?token=` so the link in the email works in one click and the token can be pasted.
   - When the token changes, call `whoami`:
     - Invalid: show "invalid or revoked token" and disable the form.
     - Valid: show "inviting as **X**" and enable the form.
   - Form fields: team name and email, then **Submit**.
   - After submitting, show "sent, waiting for organizer approval".
3. **API functions** in `src/api/extras.ts`, next to the others: `inviteWhoami`, `submitInvite`, `getInvites`, `createRootInvite`, `acceptInvite`, `rejectInvite`, `revokeInvite`.
4. **Admin tab.**
   - Add `{ to: "/admin/invites", label: "INVITES" }` to `ADMIN_TABS` and a page `src/pages/AdminInvites.tsx`.
   - The page is one flat table: team, email, status, **invited by**, decided by, created, revoked. Each row has a [revoke] button, pending rows also have [accept] and [reject] buttons, and accepted rows have a [copy link] button that copies `{web_origin}/lake-quals?token=…`. That button is how a token gets resent, for example when the email bounced.
   - A small form at the top for "create root team".
   - A flat table with an "invited by" column already answers who invited whom. An indented tree is a later extra if anyone wants it.

## Build order

1. Model, plus the `accept()` / `reject()` helpers.
2. Email.
3. All admin endpoints, plus the admin page. You can now seed root teams from the UI and see them.
4. Public endpoints, plus the `LakeQuals.tsx` page and nav tab. Pending invites can already be decided from the admin page.
5. Discord post and the interactions endpoint, then the portal setup.
6. Tests in the existing pytest setup. The important ones:
   - revoked, pending and rejected tokens are refused;
   - an unsigned interaction gets `401`;
   - a second `accept` on the same row returns `None`, leaves the first token unchanged, and sends no second email;
   - over-long or malformed `team_name`/`email` gets `422`.

## Decisions

- **Revoke affects only that one team.** Revoking team A stops A from inviting more teams. Teams A already invited keep their tokens; revoke them one by one if needed.
- **Accept/Reject also exist on the admin page**, as a fallback when Discord is down.
- **No duplicate check** on team name or email. Duplicates show up in Discord and you reject them.
- **Admins can't edit rows.** A typo means reject and re-invite.
- **No rate limit** on the public endpoints. Tokens are 192-bit, so guessing one isn't a concern, and every submission needs a human click to have any effect. The worst case is a token holder spamming the channel; revoking their token fixes that.
- **No unrevoke.** Revoking is rare, and a mistaken one is undone by setting `revoked = false` by hand in the DB.
- **Two simultaneous accepts can't both succeed.** The conditional `UPDATE` in `accept`/`reject` guarantees it, with no locking or extra state.
- **Email wording is still to be decided.** The template above is a placeholder; only the token and link are fixed.
