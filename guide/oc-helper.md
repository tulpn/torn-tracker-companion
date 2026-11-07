---
title: OC helper
seo_title: Torn organized crime role weights and success estimates
summary: On your faction's crimes tab, each role shows how much it counts, and each crime you're planning shows its success estimate.
section: Guides
group: features
order: 280
type: how-to
audience: members
icon: user-group
tier: core
keywords: torn organized crime, oc role weights, oc success chance
---

> **Test release.** The companion is in public testing. Things may change before version 1.

**Core:** free for everyone. Needs your script key.

## Role weights

On your faction's crimes tab, each slot shows its role's weight in a small badge beside
the role, such as `30.9%`: how much that role counts towards the crime's success. Hover
over the badge, or tap it on a phone, to read what the figure means; tap again to close it. Put your strongest members where the weight is highest.
The weights come from **tornprobability.com**, through torn-tracker.com, and the page says
so under the crimes. The companion never contacts tornprobability.com itself.

## Success estimates

Each crime your faction is recruiting or planning shows torn-tracker.com's success
estimate in a small green badge beside its name, such as `~72.5%`, worked out from your members' pass rates. It needs a key on
torn-tracker.com with faction API access in your faction; without one, there's no estimate.

> **What it reads and sends.** It reads the crime names and role titles on the page and
> asks torn-tracker.com for their weights and your faction's estimates. Nothing is shared.
