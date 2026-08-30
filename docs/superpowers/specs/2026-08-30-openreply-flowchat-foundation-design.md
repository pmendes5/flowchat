# FlowChat Foundation — OpenReply Adoption and Flow Engine Design

Date: 2026-08-30
Status: Design approved in chat; awaiting written-spec review
Target branch: `feat/openreply-foundation`
Repository: `pmendes5/flowchat`
OpenReply upstream baseline: `diwenne/openreply@cf9cc1ac03c918fbc84e806505b0fe9aa81acf01`

## 1. Purpose

FlowChat will adopt OpenReply as its technical foundation for Instagram connectivity and existing SaaS plumbing, then replace OpenReply's fixed campaign executor with a generic Flow Engine and visual builder.

The first product goal is not billing, enterprise permissions, or multi-channel breadth. The first goal is a reliable vertical slice in which a user can visually build, publish, and execute an Instagram automation through FlowChat.

The canonical acceptance flow is:

1. An Instagram user comments `QUERO` on a real post or reel.
2. FlowChat receives the Meta webhook.
3. FlowChat sends a public reply.
4. FlowChat sends a private reply containing the `INICIAR AQUI` postback button.
5. The Instagram user clicks the button.
6. FlowChat receives the postback.
7. FlowChat resumes the persisted flow run and sends a second DM.
8. The run is recorded as completed with an inspectable execution history.

OpenReply is the starting foundation, not the final architecture.

## 2. Repository and Migration Strategy

FlowChat remains in the existing repository `pmendes5/flowchat`.

The existing branch `feat/meta-core-backend` is preserved unchanged as a historical and architectural reference. Its stronger reliability ideas, especially persisted webhook processing and explicit external-effect state, may be selectively reintroduced later. The old NestJS backend will not be merged into OpenReply at the start.

A new branch named `feat/openreply-foundation` will be created from `main`.

OpenReply will be imported into that branch in one baseline commit rather than preserving the complete upstream Git history inside FlowChat. The repository must retain the upstream MIT license and required copyright/license notices. The exact upstream commit used for the import must be documented.

The adopted upstream baseline for this design is:

`diwenne/openreply@cf9cc1ac03c918fbc84e806505b0fe9aa81acf01`

The migration is intentionally checkpointed in Git:

1. Import OpenReply without structural redesign.
2. Make the imported application run locally.
3. Validate the existing OpenReply Instagram flow against the real Meta integration.
4. Create a baseline checkpoint.
5. Rebrand to FlowChat.
6. Add FlowChat Core primitives.
7. Replace the legacy campaign executor with the Flow Engine.
8. Add the visual builder.
9. Re-run the real Instagram acceptance flow through the new engine.
10. Remove the legacy OpenReply automation executor when the replacement is proven.

The product will not maintain two automation engines as a long-term compatibility strategy. The legacy executor is only a temporary reference during replacement.

## 3. Baseline Gate Before Refactoring

Before structural changes, the imported OpenReply baseline must prove that the existing Meta integration works in the target environment.

Baseline acceptance requires all of the following:

- application starts locally;
- PostgreSQL is healthy;
- Redis is healthy;
- worker is running;
- login works;
- workspace access works;
- Instagram OAuth connection works;
- webhook verification and delivery work;
- a campaign with keyword `QUERO` can be configured;
- a real Instagram comment reaches the system;
- the public reply is sent;
- the opening private reply is sent with a postback button;
- the `messaging_postbacks` event is received after the click;
- the reveal/second DM is sent.

If the real baseline fails for a reason intrinsic to OpenReply, that problem is fixed or re-evaluated before building the Flow Engine.

No rebrand, visual builder, AI subsystem, or broad refactor should happen before this gate passes.

## 4. Architecture Overview

FlowChat will be organized conceptually into three layers.

### 4.1 FlowChat UI

The UI contains the visual flow builder, inbox, contact views, diagnostics, and later analytics. The builder is an editor. It does not execute React Flow or browser-specific structures on the backend.

### 4.2 FlowChat Core

The Core owns channel-neutral automation concepts:

- Flow;
- FlowVersion;
- FlowRun;
- FlowRunEvent;
- WaitState;
- Contact;
- ContactIdentity;
- Tags and custom fields;
- node registry and node execution;
- trigger resolution;
- normalized events;
- external effects;
- conversation ownership and handoff state;
- AI Agent execution later in the project.

### 4.3 Channel Layer

The Channel Layer encapsulates provider-specific behavior. Initially it is Instagram/Meta and reuses OpenReply's proven OAuth, webhook, token, and messaging code.

The Flow Engine must not need to know which Graph API URL sends a DM or how a Meta access token is refreshed.

Provider input is normalized before entering the Core. Example normalized events include:

- `instagram.comment.created`;
- `instagram.message.received`;
- `instagram.story.reply.received`;
- `instagram.postback.received`;
- `instagram.follow.started`.

`instagram.follow.started` is a domain event, not a promise that Meta exposes a specific webhook. It may be produced by webhook data, polling, follower snapshots, or reconciliation. The Flow Engine only consumes the normalized event.

## 5. Data Model

The existing OpenReply schema remains in place during the foundation phase. New FlowChat Core models are added rather than forcing the current `Automation` model to represent a generic graph.

### 5.1 Flow

A Flow is the editable automation container.

Core fields:

- `id`;
- `workspaceId`;
- `name`;
- `status`;
- `draftDefinition`;
- `draftRevision`;
- `publishedVersionId`;
- timestamps.

The draft is mutable. Published versions are immutable.

### 5.2 FlowVersion

A publish operation creates a new immutable version.

Core fields:

- `id`;
- `flowId`;
- `version`;
- `definition`;
- `publishedAt`;
- `createdAt`.

Existing FlowRuns stay bound to the version they started with. Publishing v2 never changes the behavior of runs already executing v1.

### 5.3 Graph Definition

The graph is stored as versioned JSON instead of one SQL table per node and edge.

The definition contains at minimum:

- `schemaVersion`;
- `nodes`;
- `edges`.

Each node contains a stable ID, type, editor position, and typed configuration. Each edge contains source, target, and where applicable `sourceHandle` for branch outcomes.

Canvas position belongs to editor state and is ignored by execution logic.

### 5.4 FlowRun

A FlowRun is one persistent execution of one published FlowVersion for one Contact.

Minimum states:

- `RUNNING`;
- `WAITING`;
- `COMPLETED`;
- `FAILED`;
- `CANCELLED`.

Core fields include:

- `flowVersionId`;
- `contactId`;
- channel account context;
- current execution state;
- timestamps.

The database, not worker memory, is the source of truth for run state.

### 5.5 FlowRunEvent

Every meaningful state transition or side effect produces an inspectable execution event. Examples:

- `FLOW_STARTED`;
- `NODE_STARTED`;
- `NODE_COMPLETED`;
- `NODE_FAILED`;
- `FLOW_WAITING`;
- `FLOW_RESUMED`;
- `EXTERNAL_EFFECT_CREATED`;
- `EXTERNAL_EFFECT_COMPLETED`;
- `POSTBACK_RECEIVED`;
- `FLOW_COMPLETED`.

This supports debugging, contact timeline views, and future visual run inspection without relying only on worker logs.

### 5.6 WaitState

Waits are persistent data, not sleeping processes.

A WaitState records what event or time can resume a FlowRun. It supports future features such as:

- wait for postback;
- wait for message;
- delay;
- wait until date/time.

A run in a wait does not occupy a worker.

### 5.7 ExternalEffect

Provider-facing side effects are represented explicitly so retries do not blindly duplicate messages.

Relevant effect types include:

- Instagram public reply;
- Instagram private reply;
- Instagram direct message;
- future HTTP requests;
- future external CRM writes;
- later notification/provider operations where useful.

Minimum states:

- `PENDING`;
- `PROCESSING`;
- `RETRYABLE`;
- `COMPLETED`;
- `PERMANENT_FAILED`;
- `UNCERTAIN`.

Each effect has an idempotency key scoped to the logical operation. A retry of the same BullMQ job must find the same logical effect rather than automatically issuing another external request.

`UNCERTAIN` is used when the request may have reached Meta but the response was lost. Such cases must not be blindly retried as if no send occurred.

## 6. Contact and Identity Model

The Flow Engine works with FlowChat Contacts instead of raw Instagram user IDs.

### 6.1 Contact

A Contact belongs to a workspace and holds channel-neutral profile data such as display name, timestamps, and later tags/custom fields.

### 6.2 ContactIdentity

Channel identity is represented separately. An Instagram identity includes the connected account context plus the provider's external user ID and available username/profile metadata.

The identity resolver runs before trigger resolution:

normalized channel event -> resolve or create Contact -> trigger resolver -> FlowRun.

Contacts can be first observed through comments, DMs, Story replies, follower detection, or other supported channel events.

This design avoids coupling the CRM to an `InstagramUser` table and allows additional channels later without replacing the Contact model.

## 7. Trigger Model

Initial Instagram trigger vocabulary includes:

- Instagram Comment;
- Instagram Message Received;
- Instagram Story Reply;
- Instagram Postback;
- Instagram Follow Started.

The Story Reply trigger should retain contextual data when available, including story identifier, message text, and relevant media metadata.

The Follow Started trigger is produced when the relationship state changes from non-follower/unknown to follower. The detection mechanism is hidden behind the Channel Layer.

The first vertical Flow does not require all triggers to be fully implemented before the engine is proven. Comment + Postback are enough for the canonical `QUERO` flow. Story Reply and Follow Started are explicit near-term requirements after that vertical slice.

## 8. Flow Execution Model

Execution is job-based and state-persistent. Nodes do not recursively call the next node in the same process as the architectural contract.

Execution flow:

1. channel event is validated and normalized;
2. contact identity is resolved;
3. trigger resolver finds matching published FlowVersions;
4. a FlowRun is created;
5. the initial executable node is queued;
6. the node executor evaluates the node;
7. result and events are persisted;
8. the engine follows the appropriate outgoing edge;
9. the next node is queued, the run waits, completes, or fails.

A node executor returns a controlled result such as:

- continue;
- wait;
- complete;
- fail;
- branch outcome.

Nodes do not directly depend on BullMQ orchestration internals or construct Meta HTTP calls themselves.

## 9. Node Registry

Node behavior is registered by type rather than implemented through one large switch distributed across the codebase.

A registered node type defines the pieces needed by the system, including:

- type identifier;
- configuration schema;
- validation;
- execution behavior;
- metadata needed by the editor.

The first engine supports only the nodes needed for the real Instagram vertical slice:

Triggers:

- Instagram Comment;
- Instagram Postback as a supported event type where necessary.

Actions:

- Public Reply;
- Private Reply with button;
- Send Instagram Message.

Control:

- Wait for Postback;
- End.

Later node types include:

- Condition;
- Delay;
- Wait for Message;
- Add Tag;
- Remove Tag;
- Set Custom Field;
- HTTP Request;
- AI Agent.

## 10. Visual Flow Builder

The visual builder is the primary authoring experience.

The recommended canvas library is `@xyflow/react`. It is a UI dependency only and does not define runtime semantics.

The screen uses three primary areas:

- node library on the left;
- central canvas;
- configuration/properties panel on the right.

Nodes remain visually compact and show their purpose, primary configuration summary, and validation state. Large forms live in the side panel.

### 10.1 Draft Autosave

Editing updates the draft, not the published FlowVersion.

Autosave uses a debounce and revision check. The client sends the expected draft revision. If another tab has already advanced the draft revision, the server returns a conflict instead of silently overwriting newer work.

Real-time collaborative editing is out of scope for the first version.

### 10.2 Publish

Publish performs server-side validation before creating a new immutable FlowVersion.

Validation includes at minimum:

- valid trigger configuration;
- all referenced node and edge IDs exist;
- required node configuration exists;
- required output edges are connected;
- branch handles are valid;
- unreachable/invalid graph structures are rejected where they indicate authoring errors;
- unsupported node types are rejected;
- channel-specific configuration is valid for the selected connected account.

Validation errors identify the affected node so the UI can select/focus it.

### 10.3 Branches

Decision nodes return named outcomes such as `yes`, `no`, `qualified`, or `human`. Edges use `sourceHandle` to map a result to the correct next node.

The runtime follows graph semantics; it does not infer branch meaning from UI labels.

### 10.4 Test Mode

A later builder feature can execute a draft with mocked external channel actions so authors can inspect path behavior without publishing. Real-account test execution can be added after the production execution path is stable.

Test Mode is not required to complete the first real FlowChat vertical slice.

## 11. Tags, Custom Fields, and Templates

Tags and custom fields are part of the planned Core, but they follow the first canvas-driven Instagram flow.

Tags support categorical membership such as `Lead`, `Hot Lead`, or `Customer`.

Custom fields support typed data including text, number, boolean, date/datetime, and select-like values.

Message templates can later access controlled variables such as contact fields and trigger data. Arbitrary JavaScript execution in templates is not allowed.

Examples of future variables include:

- contact first name;
- custom fields;
- triggering comment text;
- triggering story context;
- flow name;
- outputs created by supported nodes.

## 12. Inbox, Conversation Ownership, and Human Handoff

OpenReply's Inbox foundation is retained and evolved.

A conversation has an operational mode with at least:

- `AUTOMATION`;
- `AI`;
- `HUMAN`.

When a human takes ownership, automated AI responses are suppressed for that conversation unless a later explicit product rule says otherwise.

Human handoff may be requested by:

- a dedicated Human Handoff node;
- AI Agent outcome;
- user language indicating a request for a human;
- future deterministic rules.

A handoff updates conversation state, exposes the conversation in an "awaiting human" inbox state, and emits a domain event such as `human.handoff.requested`.

A paused FlowRun may later be resumed after a human finishes, when the specific Flow is designed to continue after handoff. Handoff does not have to destroy the run.

## 13. Email Notification for Human Handoff

Human handoff must trigger an email alert to the configured responsible person or people.

The email notification is driven by the handoff domain event, not embedded inside an AI Agent implementation. This ensures deterministic flows and AI flows share the same alert behavior.

The email should contain useful context without requiring the recipient to search manually:

- contact display name/username when available;
- channel/account;
- Flow name when applicable;
- handoff reason;
- latest relevant message snippet;
- direct link to the FlowChat conversation.

Notification sending is asynchronous. Email failure must never roll back or block the handoff itself.

Repeated user messages while the same handoff is pending must not create one email per message. Notification state uses a dedupe key or equivalent pending-handoff identity. A new handoff notification becomes eligible after the prior handoff has been resolved and a later distinct handoff is requested.

The initial implementation may use the email capability already present in OpenReply (for example Resend/SMTP abstraction) where suitable. Provider choice remains behind a notification service boundary.

## 14. AI Agent Architecture

AI Agents are later Flow nodes, not replacements for the Flow Engine.

An AI Agent can conduct a multi-message conversation while the FlowRun remains persistently waiting for additional inbound messages.

An agent has explicit configuration such as:

- objective;
- instructions;
- tone;
- completion conditions;
- maximum interaction bounds;
- allowed tools;
- handoff behavior;
- optional knowledge sources.

Agents do not call Meta directly. Tool calls pass through FlowChat services and normal side-effect controls.

Possible tools include:

- send message;
- read allowed contact fields;
- set allowed custom fields;
- add/remove tags;
- request human handoff;
- future business integrations.

The system stores observable actions and outcomes, not private chain-of-thought. Useful AI-related run events include message sent, field updated, tag updated, tool called, handoff requested, and agent completed.

Relevant facts extracted from conversation should be persisted into structured contact fields or tags when configured rather than depending only on conversational memory.

Knowledge Base support is planned after the deterministic engine, inbox ownership, and AI node lifecycle are stable.

## 15. Webhooks, Queues, and Reliability

Meta webhook handling should move toward a persist-first processing model:

1. read raw request body;
2. validate `x-hub-signature-256`;
3. persist/deduplicate the webhook event;
4. enqueue processing;
5. return HTTP success quickly;
6. perform automation work asynchronously.

Duplicate webhook deliveries must not create duplicate logical processing.

Retries distinguish temporary failures from permanent failures. Typical temporary classes include 429 and provider 5xx responses. Invalid permissions, malformed requests, and other clearly permanent failures are not retried forever.

Ambiguous network outcomes are handled through `ExternalEffect.UNCERTAIN` rather than automatic duplicate sends.

Worker restarts must not lose FlowRun state because the database is authoritative.

Delayed execution is represented by persistent wait/resume data. A job must not sleep in memory for hours or days.

## 16. Workspace Scope and Deferred SaaS Work

Existing login and workspace concepts from OpenReply stay enabled from the beginning.

Core records must remain scoped by `workspaceId` so FlowChat does not need a dangerous data-model retrofit later.

However, advanced SaaS product work is deliberately deferred until the functional product is complete enough to justify it.

Deferred work includes:

- Stripe/billing integration;
- commercial plan design;
- advanced entitlements;
- granular RBAC;
- team routing/round robin;
- enterprise administration;
- complex usage enforcement.

The initial project focuses on building the product, not monetization infrastructure.

## 17. Explicitly Out of Scope for the First Vertical Slice

The following are not prerequisites for the first canvas-driven `QUERO` flow:

- Facebook Messenger support;
- WhatsApp support;
- billing;
- Stripe;
- plan limits;
- advanced role management;
- round-robin human assignment;
- Knowledge Base;
- AI Agent;
- complete CRM UI;
- collaboration editing;
- all possible node types;
- automatic conversion of old OpenReply campaigns;
- long-term coexistence of two automation engines.

## 18. Implementation Sequence

Implementation is divided into gates so each layer is proven before the next one increases complexity.

### Phase A — Adopt and Prove OpenReply

1. Create `feat/openreply-foundation` from `main`.
2. Import OpenReply at the pinned upstream commit in one commit.
3. Preserve MIT attribution/license requirements.
4. Configure local environment.
5. Run application, database, Redis, worker, and existing test suite.
6. Verify login and workspace behavior.
7. Connect Instagram via OAuth.
8. Execute the real `QUERO` baseline flow end to end.
9. Create a baseline checkpoint commit.

### Phase B — FlowChat Foundation

10. Rebrand product to FlowChat without altering behavior unnecessarily.
11. Establish Channel Layer boundaries around Instagram/Meta behavior.
12. Introduce normalized event contracts.
13. Add Contact and ContactIdentity minimum models/resolution.
14. Improve webhook processing toward persist-first async handling where needed.
15. Introduce ExternalEffect semantics for the side effects used by the first flow.

### Phase C — Flow Engine

16. Add Flow and FlowVersion with mutable draft and immutable publish model.
17. Add FlowRun, FlowRunEvent, and WaitState.
18. Add node registry and executor contract.
19. Implement nodes for Comment Trigger, Public Reply, Private Reply + button, Wait for Postback, Send Message, and End.
20. Prove the same `QUERO` automation through programmatically defined Flow JSON before the visual editor is relied upon.

### Phase D — Visual Builder

21. Add `@xyflow/react` and the three-pane builder shell.
22. Add first node cards and property editors.
23. Add draft autosave/revision conflict handling.
24. Add server-side graph validation and publish.
25. Build the `QUERO` Flow in the UI.
26. Publish it.
27. Execute the real Instagram acceptance flow from the published FlowVersion.
28. Confirm run/event history and side-effect state.

### Phase E — Replace Legacy Executor

29. Confirm the new engine covers the required existing baseline behavior.
30. Remove or disable legacy automation execution paths that are no longer needed.
31. Keep Git history and the baseline checkpoint as the reference instead of maintaining two runtime engines.

### Phase F — Product Expansion

32. Story Reply trigger.
33. Follow Started trigger and relationship/reconciliation state.
34. Inbox/conversation ownership and human handoff.
35. Human handoff email notification.
36. Tags and custom fields.
37. Condition, Delay, and Wait for Message.
38. AI Agent node and approved tool model.
39. Knowledge Base.
40. Later analytics and SaaS commercialization work.

## 19. Testing Strategy

Tests follow existing OpenReply project conventions and are expanded around new boundaries.

Required automated coverage includes:

- normalized event parsing/creation;
- trigger matching;
- contact identity resolution and deduplication;
- draft/publish validation;
- immutable FlowVersion behavior;
- node executor results;
- branch routing by `sourceHandle`;
- FlowRun state transitions;
- wait creation and resume matching;
- duplicate webhook handling;
- ExternalEffect idempotency behavior;
- retry classification;
- human takeover suppressing AI/automation responses as specified;
- notification dedupe for a pending handoff;
- workspace isolation for new Core resources.

Provider calls should be mocked in unit/integration tests except for explicit real Meta acceptance runs.

The real acceptance test is manual/controlled because it requires the configured Instagram account and Meta application. It is a release gate for the baseline and again for the new Flow Engine vertical slice.

## 20. Failure and Recovery Behavior

Failures should be visible and recoverable rather than silently swallowed.

A node that cannot complete records failure detail in execution history. A FlowRun transitions to `FAILED` when the engine cannot safely continue.

A future UI can support retrying a failed node/effect without replaying the whole Flow from the trigger. The data model should not prevent this, but a polished manual retry UI is not required for the first vertical slice.

Email notification failures are logged/retried independently from handoff state.

Webhook queueing and processing failures must leave enough persisted state to identify unprocessed work and retry safely.

## 21. Security Requirements

Secrets stay out of source control. The project must not log access tokens, app secrets, encryption keys, OAuth codes, or webhook verification secrets.

Meta access tokens remain encrypted at rest using the existing OpenReply foundation unless a later reviewed change replaces that implementation.

All FlowChat Core resources are workspace-scoped. Resource lookup must enforce workspace membership/context rather than trusting a resource ID alone.

AI tools, when implemented, use an allowlist and cannot bypass FlowChat service boundaries to perform unrestricted provider actions.

## 22. Definition of the First FlowChat Milestone

The first major FlowChat milestone is complete when a user can:

1. log in;
2. use a workspace;
3. connect an Instagram professional account;
4. open the Flow Builder;
5. create a new Flow;
6. add/configure an Instagram Comment trigger for `QUERO`;
7. connect a Public Reply node;
8. connect a Private Reply node with `INICIAR AQUI`;
9. connect Wait for Postback;
10. connect Send Message;
11. connect End;
12. publish successfully;
13. comment `QUERO` from a real Instagram user;
14. receive the public reply;
15. receive the opening DM with button;
16. click the button;
17. receive the second DM;
18. inspect the run as `COMPLETED` with execution history.

This milestone proves that OpenReply has stopped being merely a borrowed campaign application and has become the technical foundation of FlowChat's own Flow Engine.

## 23. Design Decisions Summary

Approved decisions:

- Use OpenReply as the new FlowChat foundation.
- Keep the existing FlowChat repository.
- Keep login and workspaces.
- Create the new foundation branch from `main`.
- Preserve `feat/meta-core-backend` unchanged as reference.
- Import OpenReply in one commit and pin/document the upstream commit.
- Validate OpenReply unchanged before rebranding/refactoring.
- Replace the fixed campaign executor rather than maintain long-term dual engines.
- Use immutable FlowVersions and a mutable draft.
- Store graph definitions as versioned JSON.
- Persist FlowRun execution state.
- Use a node registry and controlled node outcomes.
- Use `@xyflow/react` only as the visual editor layer.
- Include Instagram Comment, Message, Story Reply, Postback, and Follow Started in the trigger model.
- Represent users as Contact + channel identity.
- Add explicit ExternalEffect semantics for safe provider-facing work.
- Support human handoff with email notification and direct inbox link.
- Add AI Agents only after the deterministic Flow Engine and conversation ownership are stable.
- Defer advanced SaaS/billing work until the product itself is ready.

