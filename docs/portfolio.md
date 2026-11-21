# Showcase guide

## Suggested Upwork entry

**Title:** BuildrLab MarketingOS — AI content workflows with approval & CMS delivery

**Role:** Product engineering, AI workflow architecture and full-stack implementation

**Description:**

Built a local content operations demo that connects versioned business knowledge, optional local AI drafting, editorial checks, human approval and CMS publishing. Every approval applies to an exact revision; edits trigger a new review. A separate CMS creates real resource articles, and stable publication keys prevent duplicate writes when a delivery acknowledgement is lost. Includes a branded dashboard, source evidence, workflow traces, prompt version controls, persistent audit history and a Docker Compose setup. Uses fictional business content with explicit sample and local AI modes.

**Suggested skills:** AI Integration, Python, API Integration, Workflow Automation, Full-Stack Development

## 90-second recording

| Time | Show | Say |
|---|---|---|
| 0–15s | Dashboard | “This is BuildrLab MarketingOS, a working demonstration of how a business can take shared knowledge through content review and into its CMS.” |
| 15–30s | Brand knowledge, then a draft | “Product information, brand guidance and publishing rules are kept together. The demo runs without keys using sample passages, or it can generate a draft with a local AI model.” |
| 30–45s | Quality checks and evidence drawer | “Each draft carries its source evidence and editorial checks. Here, an invented percentage blocks approval. These checks support a reviewer; they don't replace human judgment.” |
| 45–60s | Approval dialog | “The reviewer approves this exact revision. If someone changes the draft afterwards, that approval is cleared and the content must be reviewed again.” |
| 60–75s | Publish, then CMS article | “Publishing creates a real page in a separate CMS. The system keeps a publication receipt and audit history. A retry after a lost acknowledgement returns the existing result instead of publishing a duplicate.” |
| 75–90s | Activity history, then dashboard | “Everything runs locally with Docker Compose. This shows the kind of practical AI workflow I can build for your business, with clear approvals, reliable integration and a handover your team can understand.” |

Keep the local-demo and drafting-mode labels visible. Use the timeout scenario for an additional technical clip. For the shortest recording, use an already reviewed sample draft and open the CMS article in a second tab.

## Demonstration checklist

- Start the two services and open the workspace before recording.
- Keep one unapproved draft, one blocked example and one published article available.
- Use an explicit demo reviewer label.
- Show the source drawer and one meaningful check, rather than reading every field.
- The repository is public at https://github.com/buildrlab/marketing-os and is linked from buildrlab.com/tutorials/marketing-os. Re-review the README and screenshots before each recording.
- Explain that CMS vendor integration, production identity and deployment are follow-on work.

## A scoped client pilot this demonstrates

One agreed business knowledge collection, one article type, one CMS integration, one reviewer flow and an agreed set of content checks. Deliver a working workflow, representative evaluation cases, deployment notes and a handover. Agree source quality, editorial ownership, access permissions, volume and success measures before estimating cost or delivery dates.
