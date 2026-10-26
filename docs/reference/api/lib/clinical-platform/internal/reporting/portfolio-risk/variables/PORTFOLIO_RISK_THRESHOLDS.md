[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/reporting/portfolio-risk](../README.md) / PORTFOLIO\_RISK\_THRESHOLDS

# Variable: PORTFOLIO\_RISK\_THRESHOLDS

> `const` **PORTFOLIO\_RISK\_THRESHOLDS**: `object`

The heatmap's thresholds (#2914).

- `schedule`: a study still enrolling turns amber when fewer than
  `chanceAmber` of its forecast runs meet the planned last subject in, and
  red below `chanceRed` or once the planned date has passed. Any study
  turns amber when its next milestone is overdue, and red when it is more
  than `overdueRedDays` overdue.
- `budget`: amber when either metric is above `amber`, red above `red`.
- `quality`: red when a quality tolerance limit is breached; amber when the
  assessment raised any other signal. The KRI thresholds and QTL limits
  are the RBQM library's.

## Type Declaration

### budget

> `readonly` **budget**: `object`

#### budget.amber

> `readonly` **amber**: `1.05` = `1.05`

#### budget.metricIds

> `readonly` **metricIds**: readonly \[`"budget_burn_vs_plan"`, `"forecast_vs_budget_at_completion"`\]

#### budget.reason

> `readonly` **reason**: `"Five percent over is inside what a change order or a reforecast usually absorbs; past ten percent the overrun needs the sponsor's approval."` = `"Five percent over is inside what a change order or a reforecast usually absorbs; past ten percent the overrun needs the sponsor's approval."`

#### budget.red

> `readonly` **red**: `1.1` = `1.1`

### quality

> `readonly` **quality**: `object`

#### quality.reason

> `readonly` **reason**: `"A breached quality tolerance limit puts the study's results at risk and has a planned response; any other signal raised is for the study team to review."` = `"A breached quality tolerance limit puts the study's results at risk and has a planned response; any other signal raised is for the study team to review."`

### schedule

> `readonly` **schedule**: `object`

#### schedule.chanceAmber

> `readonly` **chanceAmber**: `0.8` = `0.8`

#### schedule.chanceRed

> `readonly` **chanceRed**: `0.5` = `0.5`

#### schedule.overdueRedDays

> `readonly` **overdueRedDays**: `30` = `30`

#### schedule.reason

> `readonly` **reason**: `"A portfolio plans on its studies finishing enrollment when they said they would. Below four runs in five the plan needs a contingency; below an even chance it needs a decision. A month overdue is past what a study team can recover without one."` = `"A portfolio plans on its studies finishing enrollment when they said they would. Below four runs in five the plan needs a contingency; below an even chance it needs a decision. A month overdue is past what a study team can recover without one."`
