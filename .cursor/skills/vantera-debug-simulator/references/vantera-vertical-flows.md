# Vantera Vertical Workflow Stage Maps

Used by T7 (Automation E2E) to validate that stage transitions fire the correct automations
and that portal status messages match the expected stage patterns.

---

## HVAC

### Stage Map
```
New Call
→ Diagnosed
→ Options Presented
→ Quote Approved
→ Parts Ordered (conditional: only if parts_ordered = true in metadata)
→ Scheduled
→ In Progress
→ Completed
→ Invoice Sent
→ Payment Received
→ Review Requested
→ Maintenance Plan Offered
```

### Automation Expectations Per Stage
| Stage Entered | Expected Automation Fired |
|---|---|
| New Call (from missed_call) | send_sms: "We missed you, book here" + create_task |
| Quote Approved | send_sms: confirmation + schedule link |
| Scheduled | send_sms: tech name + arrival window |
| Completed | send_sms: invoice link + review request (2hr delay) |
| Invoice Sent | [no auto-send, unless overdue] |
| Review Requested | send_sms: review link |
| Maintenance Plan Offered | send_email: plan pricing |

### Portal Status Messages
| Stage | Client-Facing Message Pattern |
|---|---|
| Scheduled | "Your HVAC service is scheduled for {date} between {window}. {tech_name} will be your technician." |
| In Progress | "{tech_name} is currently working on your HVAC service. We'll update you when it's complete." |
| Completed | "Your HVAC service is complete. Here's a summary of what was done." |
| Invoice Sent | "Your invoice is ready. Tap below to pay." |

---

## Landscaping

### Stage Map
```
New Lead
→ Property Measured
→ Estimate Built
→ Estimate Sent
→ Follow-up
→ Contract Signed
→ First Visit Scheduled
→ Recurring Schedule Set
→ In Progress
→ Season Close + Review
→ Renewal Offered
```

### Automation Expectations
| Stage / Trigger | Expected Automation |
|---|---|
| Estimate Sent | send_sms day 2, send_email day 5, create_task day 10 |
| First Visit Scheduled (morning of) | send_sms: "Crew is on the way" |
| In Progress → Completed | send_sms: photo summary notification |
| Season Close | send_email: thank-you + referral ask + next season |
| Renewal Offered | send_email: renewal offer (30d before contract_end_date) |

---

## Plumbing / Electrical

### Stage Map
```
Emergency Call
→ Assessed On-Site
→ Options Presented
→ Approved
→ Parts Confirmed
→ In Progress
→ Completed
→ Invoice Sent
→ Payment Collected
→ Maintenance Plan Offered
→ Review Requested
```

### Automation Expectations
| Stage / Trigger | Expected Automation |
|---|---|
| Emergency Call (missed_call) | send_sms within 90 seconds |
| Approved | send_sms: confirmation + ETA |
| Completed | send_sms: invoice + review request (1hr delay) |
| Invoice Sent + 3 days unpaid | send_sms: payment reminder |

---

## Construction

### Stage Map
```
Inquiry
→ Site Visit
→ Estimate Built
→ Proposal Sent
→ Contract Signed
→ Permits
→ Demo
→ Rough Work
→ Inspections
→ Finish Work
→ Punch List
→ Final Walkthrough
→ Closed + Review
→ Warranty Period
```

### Automation Expectations
| Stage / Trigger | Expected Automation |
|---|---|
| Contract Signed | send_email: welcome + portal access |
| Each phase completion | send_portal_notification: phase update + photos |
| Change order created | send_email + portal: approval request |
| Permit approved | send_sms: milestone notification |
| 80% complete | send_email: punch list prompt + walkthrough scheduling |
| Closed + Review | send_email: review request + referral ask |
| 60 days post-close | send_email: warranty check-in |

---

## Property Management — Leasing

### Stage Map
```
Vacancy Created
→ Listed
→ Showing Scheduled
→ Application Submitted
→ Screened + Approved
→ Lease Signed
→ Move-In Inspection
→ Active Tenancy
→ 90-Day Renewal Sequence
→ Renewal Signed OR Vacancy Opened
→ Move-Out Inspection
→ Deposit Settlement
```

### Automation Expectations
| Trigger | Expected Automation |
|---|---|
| Vacancy Created | Push to Zillow/Apartments.com via integration |
| Showing request | send_sms: confirmation + self-schedule link |
| Lease Signed | send_email: welcome + portal access to tenant |
| Active Tenancy (90d before lease_end) | send_email: renewal options |
| Active Tenancy (60d, no renewal) | send_email: follow-up |
| Active Tenancy (30d, no renewal) | send_email: final notice + vacate option |

---

## Property Management — Maintenance

### Stage Map
```
Submitted
→ Vendor Assigned
→ Scheduled
→ In Progress
→ Completed
→ Tenant Confirmed
→ Work Order Closed
```

### Automation Expectations
| Stage | Expected Automation |
|---|---|
| Submitted | send_sms to tenant: "Received request #{id}" |
| Vendor Assigned | send_sms to tenant: vendor name + scheduled date |
| Completed | send_sms to tenant + send_email to owner |

---

## Agency

### Stage Map
```
New Lead
→ Discovery Call
→ Proposal Sent
→ Contract Signed
→ Onboarding
→ Active
→ Monthly Report Cycle
→ Quarterly Review
→ Renewal / Upsell
```

### Automation Expectations
| Trigger | Expected Automation |
|---|---|
| Contract Signed | send_email: welcome + portal access + onboarding checklist |
| Awaiting Approval + 48h | send_sms + send_email: reminder |
| Portal inactive 14 days | send_email: re-engagement + create_task: AM check-in |
| 1st of month | generate_ai_message (report) + send_email + portal_notification |
| 85% contracted hours | send_email: scope warning to AM + client |
| 100% contracted hours | send_email: scope complete + overage rate |
| 45d before contract end | create_task: renewal + send_email to AM |

---

## Real Estate

### Stage Map
```
Lead Captured
→ Contacted + Qualified
→ Active Buyer or Listing Agreement
→ Showings / Property Prep
→ Offer Submitted
→ Under Contract
→ Inspection
→ Appraisal
→ Clear to Close
→ Closing Day
→ Post-Close Follow-Up
→ Anniversary Re-Engagement
```

### Automation Expectations
| Trigger | Expected Automation |
|---|---|
| Lead Captured | send_sms + send_email within 60 seconds |
| Lead not contacted 24h | internal alert to broker |
| Showing request | send_sms: confirmation + agent notification |
| Offer Submitted | send_portal_notification + send_sms: status update |
| Under Contract | send_email: document checklist + timeline activated |
| Closing Day | send_email: thank-you + review request |
| 12 months post-close | send_email: anniversary + referral ask |

---

## Validation Rules for T7

When running E2E tests, verify:

1. **Stage sequence integrity**: Records cannot skip required stages without an explicit override
2. **Automation completeness**: Every stage in the map above with an expected automation must produce an automation_runs row on entry
3. **Portal message accuracy**: Client portal "What's happening" card must match the pattern for the current stage
4. **Activity log**: Every stage transition writes an activities row with actor_type and visible_to_client correctly set
5. **AI gate compliance**: generate_ai_message automations must check autonomous_ai_messaging flag before sending
