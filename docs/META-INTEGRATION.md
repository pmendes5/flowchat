# Meta integration verification

Verified on: 2026-08-28

Status: **PARTIALLY VERIFIED.** The desired opening interaction remains the
product requirement. Its exact Meta transport is an experimental capability,
not a documented impossibility. No request was sent to Meta during this
verification.

## OAuth

OAuth may continue independently of the opening-message capability. Its exact
URLs, parameters, scopes, token exchange, and account lookup must be copied only
from the current official Instagram Login documentation when implemented.

Canonical Meta documentation:
https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/

## Permissions

Permission verification may continue independently. Implement only permissions
confirmed by the current official Instagram Login documentation and the Meta App
configuration used by the project.

Canonical Meta documentation:
https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/

## Comment webhook

The official Meta Instagram API collection documents `comments` and
`live_comments` subscriptions for receiving the comment identifier used by
Private Replies.

- Canonical Meta documentation:
  https://developers.facebook.com/docs/instagram-platform/webhooks/
- Official Meta-published request documentation:
  https://www.postman.com/meta/instagram/request/23987686-189d7215-22b3-403f-b2f5-a46c7e66a514

## Public replies

Public comment replies are a separately verified operation and may be
implemented without resolving the opening-message capability.

Canonical Meta documentation:
https://developers.facebook.com/docs/instagram-platform/comment-moderation/

## Private Replies

The officially documented minimum Private Reply contract is a request addressed
with `recipient.comment_id` and a textual message (`message.text`). The
documentation also describes the one-reply and timing restrictions for the
comment-triggered opening message and the conditions for later follow-up.

This document intentionally does not infer a template attachment, button, or
postback field for that request.

- Canonical Meta documentation:
  https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/private-replies/
- Official Meta-published request documentation:
  https://www.postman.com/meta/instagram/request/23987686-189d7215-22b3-403f-b2f5-a46c7e66a514

## Regular button and postback

The officially documented Button Template contract is separate: it addresses an
existing conversation with `recipient.id` (an Instagram-scoped user ID/IGSID)
and sends a button template. A regular button with `type: "postback"` carries a
developer payload, and its interaction is documented through the
`messaging_postbacks` webhook event.

- Official Meta-published Button Template documentation:
  https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-9b7c72f8-379e-4d8c-a3e8-49dc03d8489a
- Canonical Meta send-message documentation:
  https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/send-messages/
- Canonical Meta webhook documentation:
  https://developers.facebook.com/docs/instagram-platform/webhooks/

### Opening interactive Private Reply capability

The exact combination below is **UNVERIFIED** in the public Meta documentation
consulted:

```text
comment_id + first Private Reply + regular postback button
```

The consulted documentation verifies the two contracts above independently; it
does not unequivocally document a request payload that combines them. FlowChat
must not manufacture such a payload by merging their structures.

ManyChat currently demonstrates and documents an interactive first Private
Reply containing buttons or Quick Replies whose user interaction can open the
conversation. This is evidence that the desired behavior may be available in
practice. It is therefore an experimental capability awaiting a real capability
probe, not an impossibility and not a reason to change the approved UX.

Until the probe confirms the real contract:

- Tasks for the HTTP client, OAuth, webhook signature, webhook normalization,
  and other independent backend behavior may continue;
- Meta outbound code must expose only independently verified operations;
- internal orchestration depends on `OpeningPrivateReplySender`, not on a Meta
  payload;
- the Meta implementation must fail explicitly with
  `MetaCapabilityNotVerifiedError` before attempting an HTTP request;
- tests may mock `OpeningPrivateReplySender` to prove the complete product
  sequence without claiming an unverified Meta payload works.

## Webhook signature

The official Meta webhook contract documents an HMAC-SHA256 signature in
`X-Hub-Signature-256` using the app secret. Signature verification can continue
independently of the opening-message capability.

Canonical Meta documentation:
https://developers.facebook.com/docs/graph-api/webhooks/getting-started/

## Graph API versioning

The Graph API version remains explicit and configurable. Every concrete path and
field must be checked against that configured version and the Meta App before a
real test; an example version must never be treated as product confirmation.

Canonical Meta documentation:
https://developers.facebook.com/docs/graph-api/guides/versioning/

## Capability resolution

Task 23 owns the real, credentialed capability probe. It must create a test
comment, send the first Private Reply using only a request form supported by
official documentation or separately validated evidence, verify that
`INICIAR AQUI` appears, click it, confirm the webhook, and retain sanitized
request/response evidence. This file must then be updated with the observed
contract.

If the probe confirms the regular button, implement the concrete Meta adapter
and remove the capability block. If the probe proves it cannot be done, stop and
request a product decision before adopting textual or Quick Reply fallbacks.
