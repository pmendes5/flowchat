# Meta integration verification

Verified on: 2026-08-28

Status: **BLOCKED — the approved first-message flow is not supported by the
current documented contract.** No request was sent to Meta during this
verification.

## OAuth

Not carried forward into implementation because the factual blocker below must
be resolved first. Canonical official documentation:
https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/

## Permissions

Not carried forward into implementation because the factual blocker below must
be resolved first. Canonical official documentation:
https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/

## Comment webhook

The official Meta Instagram API collection documents `comments` and
`live_comments` as the webhook subscriptions used by Private Replies. The
notification supplies the comment ID used as the Private Reply recipient.

- Canonical Meta documentation:
  https://developers.facebook.com/docs/instagram-platform/webhooks/
- Official Meta-published request documentation:
  https://www.postman.com/meta/instagram/request/23987686-189d7215-22b3-403f-b2f5-a46c7e66a514

## Public replies

Not carried forward into implementation because the factual blocker below must
be resolved first. Canonical official documentation:
https://developers.facebook.com/docs/instagram-platform/comment-moderation/

## Private Replies

The current official Meta request documentation defines Private Reply as:

- `POST https://graph.instagram.com/{api-version}/{ig-user-id}/messages`;
- `recipient.id` is the Instagram comment ID;
- `message.text` contains the reply text;
- only one Private Reply message may be sent;
- it must be sent within seven days of a post or reel comment (during the live
  broadcast for Instagram Live);
- a follow-up is allowed only after the recipient responds, and then within the
  documented 24-hour window.

Official Meta-published request documentation:
https://www.postman.com/meta/instagram/request/23987686-189d7215-22b3-403f-b2f5-a46c7e66a514

Canonical Meta documentation:
https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/private-replies/

## Regular button and postback

The current official Meta collection separately documents Button and Generic
Templates sent to an Instagram-scoped user ID (`IGSID`). A template button may
have `type: "postback"`, a title, and a developer-defined payload. A tap produces
the `messaging_postbacks` webhook event.

- Official Meta-published Button Template documentation:
  https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-9b7c72f8-379e-4d8c-a3e8-49dc03d8489a
- Canonical Meta documentation:
  https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/send-messages/

### Factual incompatibility

The approved plan requires the one allowed comment-triggered Private Reply to
contain the regular postback button `INICIAR AQUI` with payload
`FLOW_CONTINUE`. The official Private Reply contract documents a text message
addressed by comment ID, while template messages with postback buttons are
documented for an existing conversation addressed by IGSID. It does not
document a template attachment or regular postback button in the initial
Private Reply.

Consequently Tasks 10–21 must not implement the planned payload. A product
decision is required, for example changing the first Private Reply to text and
waiting for a user response before sending a template, or approving another
flow that is explicitly supported by current Meta documentation.

## Webhook signature

Implementation verification is paused because of the factual blocker. The
official Meta webhook contract documents an HMAC-SHA256 signature in
`X-Hub-Signature-256` using the app secret.

Canonical official documentation:
https://developers.facebook.com/docs/graph-api/webhooks/getting-started/

## Graph API versioning

No Graph API version is approved for implementation while the flow is blocked.
The version must remain configurable and must be rechecked against the Meta App
at the time the product flow is revised.

Canonical official documentation:
https://developers.facebook.com/docs/graph-api/guides/versioning/
