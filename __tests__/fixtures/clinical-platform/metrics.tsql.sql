-- Clinical Data Platform governed metrics, SQL Server T-SQL dialect.
-- Generated from METRIC_REGISTRY in lib/clinical-platform by scripts/generate-metric-artifacts.ts; do not edit by hand.
-- Synthetic data for demonstration. Every study, site, subject and vendor is fictional.
-- Each metric appears twice: at its minimal grouping, then grouped by study and one more dimension.

-- Subjects screened: subjects_screened 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  WHERE [f].[event_type] = N'screened'
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Subjects screened: subjects_screened 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: none.
WITH [measure] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[event_date_key]
  WHERE [f].[event_type] = N'screened'
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  [study],
  [month],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Subjects enrolled: subjects_enrolled 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  WHERE [f].[event_type] = N'enrolled'
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Subjects enrolled: subjects_enrolled 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: none.
WITH [measure] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[event_date_key]
  WHERE [f].[event_type] = N'enrolled'
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  [study],
  [month],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Enrollment vs plan: enrollment_vs_plan 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [numerator] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  WHERE [f].[event_type] = N'enrolled'
),
[denominator] AS (
  SELECT
    SUM(CAST([f].[planned_enrollment] AS FLOAT)) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[is_current] = 1
)
SELECT CAST(COALESCE((SELECT [value] FROM [numerator]), 0) AS FLOAT) / NULLIF(CAST(COALESCE((SELECT [value] FROM [denominator]), 0) AS FLOAT), 0) AS [value];

-- Enrollment vs plan: enrollment_vs_plan 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, site. Filters: none.
WITH [numerator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_site].[site_id] AS [site],
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_site] AS [dim_site] ON [dim_site].[site_key] = [f].[site_key]
  WHERE [f].[event_type] = N'enrolled'
  GROUP BY [dim_study].[study_id], [dim_site].[site_id]
),
[denominator] AS (
  SELECT
    [f].[study_id] AS [study],
    [f].[site_id] AS [site],
    SUM(CAST([f].[planned_enrollment] AS FLOAT)) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[is_current] = 1
  GROUP BY [f].[study_id], [f].[site_id]
)
SELECT
  COALESCE([n].[study], [d].[study]) AS [study],
  COALESCE([n].[site], [d].[site]) AS [site],
  CAST(COALESCE([n].[value], 0) AS FLOAT) / NULLIF(CAST(COALESCE([d].[value], 0) AS FLOAT), 0) AS [value]
FROM [numerator] AS [n]
FULL OUTER JOIN [denominator] AS [d]
  ON [d].[study] = [n].[study] AND [d].[site] = [n].[site]
ORDER BY 1, 2;

-- Screen failure rate: screen_failure_rate 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [numerator] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  WHERE [f].[event_type] = N'screened'
    AND [f].[subject_status] = N'screen-failed'
),
[denominator] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  WHERE [f].[event_type] = N'screened'
    AND [f].[subject_status] <> N'screening'
)
SELECT CAST(COALESCE((SELECT [value] FROM [numerator]), 0) AS FLOAT) / NULLIF(CAST(COALESCE((SELECT [value] FROM [denominator]), 0) AS FLOAT), 0) AS [value];

-- Screen failure rate: screen_failure_rate 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: none.
WITH [numerator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[event_date_key]
  WHERE [f].[event_type] = N'screened'
    AND [f].[subject_status] = N'screen-failed'
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
),
[denominator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[event_date_key]
  WHERE [f].[event_type] = N'screened'
    AND [f].[subject_status] <> N'screening'
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  COALESCE([n].[study], [d].[study]) AS [study],
  COALESCE([n].[month], [d].[month]) AS [month],
  CAST(COALESCE([n].[value], 0) AS FLOAT) / NULLIF(CAST(COALESCE([d].[value], 0) AS FLOAT), 0) AS [value]
FROM [numerator] AS [n]
FULL OUTER JOIN [denominator] AS [d]
  ON [d].[study] = [n].[study] AND [d].[month] = [n].[month]
ORDER BY 1, 2;

-- Screen failures: screen_failures 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  WHERE [f].[event_type] = N'screened'
    AND [f].[subject_status] = N'screen-failed'
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Screen failures: screen_failures 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: none.
WITH [measure] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[event_date_key]
  WHERE [f].[event_type] = N'screened'
    AND [f].[subject_status] = N'screen-failed'
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  [study],
  [month],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Early termination rate: early_termination_rate 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [numerator] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  WHERE [f].[event_type] = N'discontinued'
),
[denominator] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  WHERE [f].[event_type] = N'enrolled'
)
SELECT CAST(COALESCE((SELECT [value] FROM [numerator]), 0) AS FLOAT) / NULLIF(CAST(COALESCE((SELECT [value] FROM [denominator]), 0) AS FLOAT), 0) AS [value];

-- Early termination rate: early_termination_rate 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, site. Filters: none.
WITH [numerator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_site].[site_id] AS [site],
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_site] AS [dim_site] ON [dim_site].[site_key] = [f].[site_key]
  WHERE [f].[event_type] = N'discontinued'
  GROUP BY [dim_study].[study_id], [dim_site].[site_id]
),
[denominator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_site].[site_id] AS [site],
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_site] AS [dim_site] ON [dim_site].[site_key] = [f].[site_key]
  WHERE [f].[event_type] = N'enrolled'
  GROUP BY [dim_study].[study_id], [dim_site].[site_id]
)
SELECT
  COALESCE([n].[study], [d].[study]) AS [study],
  COALESCE([n].[site], [d].[site]) AS [site],
  CAST(COALESCE([n].[value], 0) AS FLOAT) / NULLIF(CAST(COALESCE([d].[value], 0) AS FLOAT), 0) AS [value]
FROM [numerator] AS [n]
FULL OUTER JOIN [denominator] AS [d]
  ON [d].[study] = [n].[study] AND [d].[site] = [n].[site]
ORDER BY 1, 2;

-- Site activation cycle time: site_activation_cycle_time 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(DATEDIFF(DAY, [f].[valid_from], [f].[activated_on]) AS FLOAT)) OVER () AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[activated_on] IS NOT NULL
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Site activation cycle time: site_activation_cycle_time 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, site. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    [f].[study_id] AS [study],
    [f].[site_id] AS [site],
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(DATEDIFF(DAY, [f].[valid_from], [f].[activated_on]) AS FLOAT)) OVER (PARTITION BY [f].[study_id], [f].[site_id]) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[activated_on] IS NOT NULL
)
SELECT
  [study],
  [site],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Sites selected: sites_selected 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[selected_on] IS NOT NULL
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Sites selected: sites_selected 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, site. Filters: none.
WITH [measure] AS (
  SELECT
    [f].[study_id] AS [study],
    [f].[site_id] AS [site],
    COUNT(*) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[selected_on] IS NOT NULL
  GROUP BY [f].[study_id], [f].[site_id]
)
SELECT
  [study],
  [site],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Sites contracted: sites_contracted 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[contracted_on] IS NOT NULL
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Sites contracted: sites_contracted 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, site. Filters: none.
WITH [measure] AS (
  SELECT
    [f].[study_id] AS [study],
    [f].[site_id] AS [site],
    COUNT(*) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[contracted_on] IS NOT NULL
  GROUP BY [f].[study_id], [f].[site_id]
)
SELECT
  [study],
  [site],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Sites IRB approved: sites_irb_approved 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[irb_approved_on] IS NOT NULL
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Sites IRB approved: sites_irb_approved 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, site. Filters: none.
WITH [measure] AS (
  SELECT
    [f].[study_id] AS [study],
    [f].[site_id] AS [site],
    COUNT(*) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[irb_approved_on] IS NOT NULL
  GROUP BY [f].[study_id], [f].[site_id]
)
SELECT
  [study],
  [site],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Sites initiated: sites_initiated 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[initiated_on] IS NOT NULL
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Sites initiated: sites_initiated 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, site. Filters: none.
WITH [measure] AS (
  SELECT
    [f].[study_id] AS [study],
    [f].[site_id] AS [site],
    COUNT(*) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[initiated_on] IS NOT NULL
  GROUP BY [f].[study_id], [f].[site_id]
)
SELECT
  [study],
  [site],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Sites activated: sites_activated 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[activated_on] IS NOT NULL
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Sites activated: sites_activated 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, site. Filters: none.
WITH [measure] AS (
  SELECT
    [f].[study_id] AS [study],
    [f].[site_id] AS [site],
    COUNT(*) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[activated_on] IS NOT NULL
  GROUP BY [f].[study_id], [f].[site_id]
)
SELECT
  [study],
  [site],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Sites with a first subject in: sites_with_first_subject_in 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[first_subject_in_on] IS NOT NULL
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Sites with a first subject in: sites_with_first_subject_in 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, site. Filters: none.
WITH [measure] AS (
  SELECT
    [f].[study_id] AS [study],
    [f].[site_id] AS [site],
    COUNT(*) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[first_subject_in_on] IS NOT NULL
  GROUP BY [f].[study_id], [f].[site_id]
)
SELECT
  [study],
  [site],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Selection to executed agreement: selection_to_contract_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(DATEDIFF(DAY, [f].[selected_on], [f].[contracted_on]) AS FLOAT)) OVER () AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[selected_on] IS NOT NULL
    AND [f].[contracted_on] IS NOT NULL
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Selection to executed agreement: selection_to_contract_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, site. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    [f].[study_id] AS [study],
    [f].[site_id] AS [site],
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(DATEDIFF(DAY, [f].[selected_on], [f].[contracted_on]) AS FLOAT)) OVER (PARTITION BY [f].[study_id], [f].[site_id]) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[selected_on] IS NOT NULL
    AND [f].[contracted_on] IS NOT NULL
)
SELECT
  [study],
  [site],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Executed agreement to IRB approval: contract_to_irb_approval_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(DATEDIFF(DAY, [f].[contracted_on], [f].[irb_approved_on]) AS FLOAT)) OVER () AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[contracted_on] IS NOT NULL
    AND [f].[irb_approved_on] IS NOT NULL
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Executed agreement to IRB approval: contract_to_irb_approval_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, site. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    [f].[study_id] AS [study],
    [f].[site_id] AS [site],
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(DATEDIFF(DAY, [f].[contracted_on], [f].[irb_approved_on]) AS FLOAT)) OVER (PARTITION BY [f].[study_id], [f].[site_id]) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[contracted_on] IS NOT NULL
    AND [f].[irb_approved_on] IS NOT NULL
)
SELECT
  [study],
  [site],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- IRB approval to initiation visit: irb_approval_to_initiation_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(DATEDIFF(DAY, [f].[irb_approved_on], [f].[initiated_on]) AS FLOAT)) OVER () AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[irb_approved_on] IS NOT NULL
    AND [f].[initiated_on] IS NOT NULL
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- IRB approval to initiation visit: irb_approval_to_initiation_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, site. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    [f].[study_id] AS [study],
    [f].[site_id] AS [site],
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(DATEDIFF(DAY, [f].[irb_approved_on], [f].[initiated_on]) AS FLOAT)) OVER (PARTITION BY [f].[study_id], [f].[site_id]) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[irb_approved_on] IS NOT NULL
    AND [f].[initiated_on] IS NOT NULL
)
SELECT
  [study],
  [site],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Initiation visit to activation: initiation_to_activation_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(DATEDIFF(DAY, [f].[initiated_on], [f].[activated_on]) AS FLOAT)) OVER () AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[initiated_on] IS NOT NULL
    AND [f].[activated_on] IS NOT NULL
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Initiation visit to activation: initiation_to_activation_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, site. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    [f].[study_id] AS [study],
    [f].[site_id] AS [site],
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(DATEDIFF(DAY, [f].[initiated_on], [f].[activated_on]) AS FLOAT)) OVER (PARTITION BY [f].[study_id], [f].[site_id]) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[initiated_on] IS NOT NULL
    AND [f].[activated_on] IS NOT NULL
)
SELECT
  [study],
  [site],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Activation to first subject in: activation_to_first_subject_in_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(DATEDIFF(DAY, [f].[activated_on], [f].[first_subject_in_on]) AS FLOAT)) OVER () AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[activated_on] IS NOT NULL
    AND [f].[first_subject_in_on] IS NOT NULL
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Activation to first subject in: activation_to_first_subject_in_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, site. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    [f].[study_id] AS [study],
    [f].[site_id] AS [site],
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(DATEDIFF(DAY, [f].[activated_on], [f].[first_subject_in_on]) AS FLOAT)) OVER (PARTITION BY [f].[study_id], [f].[site_id]) AS [value]
  FROM [gold].[dim_site] AS [f]
  WHERE [f].[version_number] = 1
    AND [f].[activated_on] IS NOT NULL
    AND [f].[first_subject_in_on] IS NOT NULL
)
SELECT
  [study],
  [site],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Data entry lag (median): data_entry_lag_median 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST([f].[entry_lag_days] AS FLOAT)) OVER () AS [value]
  FROM [gold].[fct_visit] AS [f]
  WHERE [f].[entry_lag_days] IS NOT NULL
    AND [f].[visit_date_key] IS NOT NULL
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Data entry lag (median): data_entry_lag_median 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST([f].[entry_lag_days] AS FLOAT)) OVER (PARTITION BY [dim_study].[study_id], [dim_date].[year_month]) AS [value]
  FROM [gold].[fct_visit] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[visit_date_key]
  WHERE [f].[entry_lag_days] IS NOT NULL
    AND [f].[visit_date_key] IS NOT NULL
)
SELECT
  [study],
  [month],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Data entry lag (90th percentile): data_entry_lag_p90 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY CAST([f].[entry_lag_days] AS FLOAT)) OVER () AS [value]
  FROM [gold].[fct_visit] AS [f]
  WHERE [f].[entry_lag_days] IS NOT NULL
    AND [f].[visit_date_key] IS NOT NULL
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Data entry lag (90th percentile): data_entry_lag_p90 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY CAST([f].[entry_lag_days] AS FLOAT)) OVER (PARTITION BY [dim_study].[study_id], [dim_date].[year_month]) AS [value]
  FROM [gold].[fct_visit] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[visit_date_key]
  WHERE [f].[entry_lag_days] IS NOT NULL
    AND [f].[visit_date_key] IS NOT NULL
)
SELECT
  [study],
  [month],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Data entry lag (mean): data_entry_lag_mean 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT
    AVG(CAST([f].[entry_lag_days] AS FLOAT)) AS [value]
  FROM [gold].[fct_visit] AS [f]
  WHERE [f].[entry_lag_days] IS NOT NULL
    AND [f].[visit_date_key] IS NOT NULL
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Data entry lag (mean): data_entry_lag_mean 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: none.
WITH [measure] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    AVG(CAST([f].[entry_lag_days] AS FLOAT)) AS [value]
  FROM [gold].[fct_visit] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[visit_date_key]
  WHERE [f].[entry_lag_days] IS NOT NULL
    AND [f].[visit_date_key] IS NOT NULL
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  [study],
  [month],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Missed visit rate: missed_visit_rate 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [numerator] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_visit] AS [f]
  WHERE [f].[visit_status] = N'missed'
),
[denominator] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_visit] AS [f]
)
SELECT CAST(COALESCE((SELECT [value] FROM [numerator]), 0) AS FLOAT) / NULLIF(CAST(COALESCE((SELECT [value] FROM [denominator]), 0) AS FLOAT), 0) AS [value];

-- Missed visit rate: missed_visit_rate 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: none.
WITH [numerator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_visit] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[planned_date_key]
  WHERE [f].[visit_status] = N'missed'
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
),
[denominator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_visit] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[planned_date_key]
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  COALESCE([n].[study], [d].[study]) AS [study],
  COALESCE([n].[month], [d].[month]) AS [month],
  CAST(COALESCE([n].[value], 0) AS FLOAT) / NULLIF(CAST(COALESCE([d].[value], 0) AS FLOAT), 0) AS [value]
FROM [numerator] AS [n]
FULL OUTER JOIN [denominator] AS [d]
  ON [d].[study] = [n].[study] AND [d].[month] = [n].[month]
ORDER BY 1, 2;

-- Out-of-window visit rate: out_of_window_visit_rate 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [numerator] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_visit] AS [f]
  WHERE [f].[visit_date_key] IS NOT NULL
    AND [f].[is_out_of_window] = 1
),
[denominator] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_visit] AS [f]
  WHERE [f].[visit_date_key] IS NOT NULL
)
SELECT CAST(COALESCE((SELECT [value] FROM [numerator]), 0) AS FLOAT) / NULLIF(CAST(COALESCE((SELECT [value] FROM [denominator]), 0) AS FLOAT), 0) AS [value];

-- Out-of-window visit rate: out_of_window_visit_rate 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: none.
WITH [numerator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_visit] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[visit_date_key]
  WHERE [f].[visit_date_key] IS NOT NULL
    AND [f].[is_out_of_window] = 1
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
),
[denominator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_visit] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[visit_date_key]
  WHERE [f].[visit_date_key] IS NOT NULL
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  COALESCE([n].[study], [d].[study]) AS [study],
  COALESCE([n].[month], [d].[month]) AS [month],
  CAST(COALESCE([n].[value], 0) AS FLOAT) / NULLIF(CAST(COALESCE([d].[value], 0) AS FLOAT), 0) AS [value]
FROM [numerator] AS [n]
FULL OUTER JOIN [denominator] AS [d]
  ON [d].[study] = [n].[study] AND [d].[month] = [n].[month]
ORDER BY 1, 2;

-- Query rate per 100 visits: query_rate_per_100_visits 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [numerator] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_query] AS [f]
),
[denominator] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_visit] AS [f]
  WHERE [f].[visit_date_key] IS NOT NULL
)
SELECT 100 * CAST(COALESCE((SELECT [value] FROM [numerator]), 0) AS FLOAT) / NULLIF(CAST(COALESCE((SELECT [value] FROM [denominator]), 0) AS FLOAT), 0) AS [value];

-- Query rate per 100 visits: query_rate_per_100_visits 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: none.
WITH [numerator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_query] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[opened_date_key]
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
),
[denominator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_visit] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[visit_date_key]
  WHERE [f].[visit_date_key] IS NOT NULL
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  COALESCE([n].[study], [d].[study]) AS [study],
  COALESCE([n].[month], [d].[month]) AS [month],
  100 * CAST(COALESCE([n].[value], 0) AS FLOAT) / NULLIF(CAST(COALESCE([d].[value], 0) AS FLOAT), 0) AS [value]
FROM [numerator] AS [n]
FULL OUTER JOIN [denominator] AS [d]
  ON [d].[study] = [n].[study] AND [d].[month] = [n].[month]
ORDER BY 1, 2;

-- Open queries: open_query_count 1.1.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: study_status not in (closed).
WITH [measure] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_query] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  WHERE [f].[query_status] IN (N'open', N'answered')
    AND [dim_study].[study_status] NOT IN (N'closed')
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Open queries: open_query_count 1.1.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: study_status not in (closed).
WITH [measure] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_query] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[opened_date_key]
  WHERE [f].[query_status] IN (N'open', N'answered')
    AND [dim_study].[study_status] NOT IN (N'closed')
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  [study],
  [month],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Query aging: query_aging_mean 1.1.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: study_status not in (closed). Data cut: 2026-09-30.
WITH [measure] AS (
  SELECT
    AVG(CAST(DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) AS FLOAT)) AS [value]
  FROM [gold].[fct_query] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  WHERE [f].[query_status] IN (N'open', N'answered')
    AND [dim_study].[study_status] NOT IN (N'closed')
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Query aging: query_aging_mean 1.1.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: study_status not in (closed). Data cut: 2026-09-30.
WITH [measure] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    AVG(CAST(DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) AS FLOAT)) AS [value]
  FROM [gold].[fct_query] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[opened_date_key]
  WHERE [f].[query_status] IN (N'open', N'answered')
    AND [dim_study].[study_status] NOT IN (N'closed')
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  [study],
  [month],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Query resolution time (median): query_resolution_time_median 1.1.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CONVERT(DATE, CAST([f].[closed_date_key] AS CHAR(8)), 112)) AS FLOAT)) OVER () AS [value]
  FROM [gold].[fct_query] AS [f]
  WHERE [f].[closed_date_key] IS NOT NULL
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Query resolution time (median): query_resolution_time_median 1.1.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CONVERT(DATE, CAST([f].[closed_date_key] AS CHAR(8)), 112)) AS FLOAT)) OVER (PARTITION BY [dim_study].[study_id], [dim_date].[year_month]) AS [value]
  FROM [gold].[fct_query] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[opened_date_key]
  WHERE [f].[closed_date_key] IS NOT NULL
)
SELECT
  [study],
  [month],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Open queries aged 0 to 7 days: open_queries_aged_0_7_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: study_status not in (closed). Data cut: 2026-09-30.
WITH [measure] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_query] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  WHERE [f].[query_status] IN (N'open', N'answered')
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) >= 0
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) <= 7
    AND [dim_study].[study_status] NOT IN (N'closed')
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Open queries aged 0 to 7 days: open_queries_aged_0_7_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: study_status not in (closed). Data cut: 2026-09-30.
WITH [measure] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_query] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[opened_date_key]
  WHERE [f].[query_status] IN (N'open', N'answered')
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) >= 0
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) <= 7
    AND [dim_study].[study_status] NOT IN (N'closed')
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  [study],
  [month],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Open queries aged 8 to 30 days: open_queries_aged_8_30_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: study_status not in (closed). Data cut: 2026-09-30.
WITH [measure] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_query] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  WHERE [f].[query_status] IN (N'open', N'answered')
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) >= 8
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) <= 30
    AND [dim_study].[study_status] NOT IN (N'closed')
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Open queries aged 8 to 30 days: open_queries_aged_8_30_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: study_status not in (closed). Data cut: 2026-09-30.
WITH [measure] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_query] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[opened_date_key]
  WHERE [f].[query_status] IN (N'open', N'answered')
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) >= 8
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) <= 30
    AND [dim_study].[study_status] NOT IN (N'closed')
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  [study],
  [month],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Open queries aged 31 to 60 days: open_queries_aged_31_60_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: study_status not in (closed). Data cut: 2026-09-30.
WITH [measure] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_query] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  WHERE [f].[query_status] IN (N'open', N'answered')
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) >= 31
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) <= 60
    AND [dim_study].[study_status] NOT IN (N'closed')
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Open queries aged 31 to 60 days: open_queries_aged_31_60_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: study_status not in (closed). Data cut: 2026-09-30.
WITH [measure] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_query] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[opened_date_key]
  WHERE [f].[query_status] IN (N'open', N'answered')
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) >= 31
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) <= 60
    AND [dim_study].[study_status] NOT IN (N'closed')
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  [study],
  [month],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Open queries aged over 60 days: open_queries_aged_over_60_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: study_status not in (closed). Data cut: 2026-09-30.
WITH [measure] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_query] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  WHERE [f].[query_status] IN (N'open', N'answered')
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) >= 61
    AND [dim_study].[study_status] NOT IN (N'closed')
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Open queries aged over 60 days: open_queries_aged_over_60_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: study_status not in (closed). Data cut: 2026-09-30.
WITH [measure] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_query] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[opened_date_key]
  WHERE [f].[query_status] IN (N'open', N'answered')
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[opened_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) >= 61
    AND [dim_study].[study_status] NOT IN (N'closed')
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  [study],
  [month],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- SDV completion: sdv_completion 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [numerator] AS (
  SELECT
    SUM(CAST([f].[sdv_pages_verified] AS FLOAT)) AS [value]
  FROM [gold].[fct_monitoring_visit] AS [f]
),
[denominator] AS (
  SELECT
    SUM(CAST([f].[sdv_pages_due] AS FLOAT)) AS [value]
  FROM [gold].[fct_monitoring_visit] AS [f]
)
SELECT CAST(COALESCE((SELECT [value] FROM [numerator]), 0) AS FLOAT) / NULLIF(CAST(COALESCE((SELECT [value] FROM [denominator]), 0) AS FLOAT), 0) AS [value];

-- SDV completion: sdv_completion 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: none.
WITH [numerator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    SUM(CAST([f].[sdv_pages_verified] AS FLOAT)) AS [value]
  FROM [gold].[fct_monitoring_visit] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[visit_date_key]
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
),
[denominator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    SUM(CAST([f].[sdv_pages_due] AS FLOAT)) AS [value]
  FROM [gold].[fct_monitoring_visit] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[visit_date_key]
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  COALESCE([n].[study], [d].[study]) AS [study],
  COALESCE([n].[month], [d].[month]) AS [month],
  CAST(COALESCE([n].[value], 0) AS FLOAT) / NULLIF(CAST(COALESCE([d].[value], 0) AS FLOAT), 0) AS [value]
FROM [numerator] AS [n]
FULL OUTER JOIN [denominator] AS [d]
  ON [d].[study] = [n].[study] AND [d].[month] = [n].[month]
ORDER BY 1, 2;

-- Overdue monitoring visit reports: monitoring_reports_overdue 2.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: study_status not in (closed). Data cut: 2026-09-30.
WITH [measure] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_monitoring_visit] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  WHERE [f].[report_final_date_key] IS NULL
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[report_due_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) > 0
    AND [dim_study].[study_status] NOT IN (N'closed')
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Overdue monitoring visit reports: monitoring_reports_overdue 2.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: study_status not in (closed). Data cut: 2026-09-30.
WITH [measure] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_monitoring_visit] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[visit_date_key]
  WHERE [f].[report_final_date_key] IS NULL
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[report_due_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) > 0
    AND [dim_study].[study_status] NOT IN (N'closed')
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  [study],
  [month],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Overdue interim monitoring visits: monitoring_visits_overdue 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: study_status not in (closed). Data cut: 2026-09-30.
WITH [measure] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_planned_monitoring_visit] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  WHERE [f].[actual_date_key] IS NULL
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[due_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) > 0
    AND [dim_study].[study_status] NOT IN (N'closed')
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Overdue interim monitoring visits: monitoring_visits_overdue 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: study_status not in (closed). Data cut: 2026-09-30.
WITH [measure] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_planned_monitoring_visit] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[due_date_key]
  WHERE [f].[actual_date_key] IS NULL
    AND DATEDIFF(DAY, CONVERT(DATE, CAST([f].[due_date_key] AS CHAR(8)), 112), CAST(N'2026-09-30' AS DATE)) > 0
    AND [dim_study].[study_status] NOT IN (N'closed')
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  [study],
  [month],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Monitoring report cycle time (median): monitoring_report_cycle_time_median 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST([f].[days_to_final_report] AS FLOAT)) OVER () AS [value]
  FROM [gold].[fct_monitoring_visit] AS [f]
  WHERE [f].[days_to_final_report] IS NOT NULL
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Monitoring report cycle time (median): monitoring_report_cycle_time_median 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: none.
WITH [measure] AS (
  SELECT DISTINCT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST([f].[days_to_final_report] AS FLOAT)) OVER (PARTITION BY [dim_study].[study_id], [dim_date].[year_month]) AS [value]
  FROM [gold].[fct_monitoring_visit] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[visit_date_key]
  WHERE [f].[days_to_final_report] IS NOT NULL
)
SELECT
  [study],
  [month],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Important deviations per 100 subjects: important_deviation_rate 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [numerator] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_deviation] AS [f]
  WHERE [f].[is_important] = 1
),
[denominator] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  WHERE [f].[event_type] = N'enrolled'
)
SELECT 100 * CAST(COALESCE((SELECT [value] FROM [numerator]), 0) AS FLOAT) / NULLIF(CAST(COALESCE((SELECT [value] FROM [denominator]), 0) AS FLOAT), 0) AS [value];

-- Important deviations per 100 subjects: important_deviation_rate 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, site. Filters: none.
WITH [numerator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_site].[site_id] AS [site],
    COUNT(*) AS [value]
  FROM [gold].[fct_deviation] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_site] AS [dim_site] ON [dim_site].[site_key] = [f].[site_key]
  WHERE [f].[is_important] = 1
  GROUP BY [dim_study].[study_id], [dim_site].[site_id]
),
[denominator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_site].[site_id] AS [site],
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_site] AS [dim_site] ON [dim_site].[site_key] = [f].[site_key]
  WHERE [f].[event_type] = N'enrolled'
  GROUP BY [dim_study].[study_id], [dim_site].[site_id]
)
SELECT
  COALESCE([n].[study], [d].[study]) AS [study],
  COALESCE([n].[site], [d].[site]) AS [site],
  100 * CAST(COALESCE([n].[value], 0) AS FLOAT) / NULLIF(CAST(COALESCE([d].[value], 0) AS FLOAT), 0) AS [value]
FROM [numerator] AS [n]
FULL OUTER JOIN [denominator] AS [d]
  ON [d].[study] = [n].[study] AND [d].[site] = [n].[site]
ORDER BY 1, 2;

-- Non-important deviations per 100 subjects: non_important_deviation_rate 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [numerator] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_deviation] AS [f]
  WHERE [f].[is_important] = 0
),
[denominator] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  WHERE [f].[event_type] = N'enrolled'
)
SELECT 100 * CAST(COALESCE((SELECT [value] FROM [numerator]), 0) AS FLOAT) / NULLIF(CAST(COALESCE((SELECT [value] FROM [denominator]), 0) AS FLOAT), 0) AS [value];

-- Non-important deviations per 100 subjects: non_important_deviation_rate 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, site. Filters: none.
WITH [numerator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_site].[site_id] AS [site],
    COUNT(*) AS [value]
  FROM [gold].[fct_deviation] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_site] AS [dim_site] ON [dim_site].[site_key] = [f].[site_key]
  WHERE [f].[is_important] = 0
  GROUP BY [dim_study].[study_id], [dim_site].[site_id]
),
[denominator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_site].[site_id] AS [site],
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_site] AS [dim_site] ON [dim_site].[site_key] = [f].[site_key]
  WHERE [f].[event_type] = N'enrolled'
  GROUP BY [dim_study].[study_id], [dim_site].[site_id]
)
SELECT
  COALESCE([n].[study], [d].[study]) AS [study],
  COALESCE([n].[site], [d].[site]) AS [site],
  100 * CAST(COALESCE([n].[value], 0) AS FLOAT) / NULLIF(CAST(COALESCE([d].[value], 0) AS FLOAT), 0) AS [value]
FROM [numerator] AS [n]
FULL OUTER JOIN [denominator] AS [d]
  ON [d].[study] = [n].[study] AND [d].[site] = [n].[site]
ORDER BY 1, 2;

-- Subjects with an important deviation: subjects_with_important_deviation 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [numerator] AS (
  SELECT
    COUNT(DISTINCT [f].[subject_id]) AS [value]
  FROM [gold].[fct_deviation] AS [f]
  WHERE [f].[is_important] = 1
),
[denominator] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  WHERE [f].[event_type] = N'enrolled'
)
SELECT CAST(COALESCE((SELECT [value] FROM [numerator]), 0) AS FLOAT) / NULLIF(CAST(COALESCE((SELECT [value] FROM [denominator]), 0) AS FLOAT), 0) AS [value];

-- Subjects with an important deviation: subjects_with_important_deviation 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, site. Filters: none.
WITH [numerator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_site].[site_id] AS [site],
    COUNT(DISTINCT [f].[subject_id]) AS [value]
  FROM [gold].[fct_deviation] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_site] AS [dim_site] ON [dim_site].[site_key] = [f].[site_key]
  WHERE [f].[is_important] = 1
  GROUP BY [dim_study].[study_id], [dim_site].[site_id]
),
[denominator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_site].[site_id] AS [site],
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_site] AS [dim_site] ON [dim_site].[site_key] = [f].[site_key]
  WHERE [f].[event_type] = N'enrolled'
  GROUP BY [dim_study].[study_id], [dim_site].[site_id]
)
SELECT
  COALESCE([n].[study], [d].[study]) AS [study],
  COALESCE([n].[site], [d].[site]) AS [site],
  CAST(COALESCE([n].[value], 0) AS FLOAT) / NULLIF(CAST(COALESCE([d].[value], 0) AS FLOAT), 0) AS [value]
FROM [numerator] AS [n]
FULL OUTER JOIN [denominator] AS [d]
  ON [d].[study] = [n].[study] AND [d].[site] = [n].[site]
ORDER BY 1, 2;

-- Protocol deviations: protocol_deviation_count 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [measure] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_deviation] AS [f]
)
SELECT CAST((SELECT [value] FROM [measure]) AS FLOAT) AS [value];

-- Protocol deviations: protocol_deviation_count 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: none.
WITH [measure] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    COUNT(*) AS [value]
  FROM [gold].[fct_deviation] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[occurred_date_key]
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  [study],
  [month],
  CAST([value] AS FLOAT) AS [value]
FROM [measure]
ORDER BY 1, 2;

-- Protocol final to first subject in: protocol_final_to_fpi_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study. Filters: none.
WITH [span] AS (
  SELECT
    [f].[study_key],
    MAX(CASE WHEN [dim_milestone].[milestone_kind] = N'protocol-final' THEN CONVERT(DATE, CAST([f].[actual_date_key] AS CHAR(8)), 112) END) AS [from_date],
    MAX(CASE WHEN [dim_milestone].[milestone_kind] = N'first-subject-in' THEN CONVERT(DATE, CAST([f].[actual_date_key] AS CHAR(8)), 112) END) AS [to_date]
  FROM [gold].[fct_milestone] AS [f]
  JOIN [gold].[dim_milestone] AS [dim_milestone] ON [dim_milestone].[milestone_key] = [f].[milestone_key]
  WHERE [f].[actual_date_key] IS NOT NULL
  GROUP BY [f].[study_key]
)
SELECT
  [dim_study].[study_id] AS [study],
  CAST(DATEDIFF(DAY, [s].[from_date], [s].[to_date]) AS FLOAT) AS [value]
FROM [span] AS [s]
JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [s].[study_key]
WHERE [s].[from_date] IS NOT NULL
  AND [s].[to_date] IS NOT NULL
ORDER BY 1;

-- Protocol final to first subject in: protocol_final_to_fpi_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, phase. Filters: none.
WITH [span] AS (
  SELECT
    [f].[study_key],
    MAX(CASE WHEN [dim_milestone].[milestone_kind] = N'protocol-final' THEN CONVERT(DATE, CAST([f].[actual_date_key] AS CHAR(8)), 112) END) AS [from_date],
    MAX(CASE WHEN [dim_milestone].[milestone_kind] = N'first-subject-in' THEN CONVERT(DATE, CAST([f].[actual_date_key] AS CHAR(8)), 112) END) AS [to_date]
  FROM [gold].[fct_milestone] AS [f]
  JOIN [gold].[dim_milestone] AS [dim_milestone] ON [dim_milestone].[milestone_key] = [f].[milestone_key]
  WHERE [f].[actual_date_key] IS NOT NULL
  GROUP BY [f].[study_key]
)
SELECT
  [dim_study].[study_id] AS [study],
  [dim_study].[phase] AS [phase],
  CAST(DATEDIFF(DAY, [s].[from_date], [s].[to_date]) AS FLOAT) AS [value]
FROM [span] AS [s]
JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [s].[study_key]
WHERE [s].[from_date] IS NOT NULL
  AND [s].[to_date] IS NOT NULL
ORDER BY 1, 2;

-- First subject in to last subject in: fpi_to_lpi_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study. Filters: none.
WITH [span] AS (
  SELECT
    [f].[study_key],
    MAX(CASE WHEN [dim_milestone].[milestone_kind] = N'first-subject-in' THEN CONVERT(DATE, CAST([f].[actual_date_key] AS CHAR(8)), 112) END) AS [from_date],
    MAX(CASE WHEN [dim_milestone].[milestone_kind] = N'last-subject-in' THEN CONVERT(DATE, CAST([f].[actual_date_key] AS CHAR(8)), 112) END) AS [to_date]
  FROM [gold].[fct_milestone] AS [f]
  JOIN [gold].[dim_milestone] AS [dim_milestone] ON [dim_milestone].[milestone_key] = [f].[milestone_key]
  WHERE [f].[actual_date_key] IS NOT NULL
  GROUP BY [f].[study_key]
)
SELECT
  [dim_study].[study_id] AS [study],
  CAST(DATEDIFF(DAY, [s].[from_date], [s].[to_date]) AS FLOAT) AS [value]
FROM [span] AS [s]
JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [s].[study_key]
WHERE [s].[from_date] IS NOT NULL
  AND [s].[to_date] IS NOT NULL
ORDER BY 1;

-- First subject in to last subject in: fpi_to_lpi_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, phase. Filters: none.
WITH [span] AS (
  SELECT
    [f].[study_key],
    MAX(CASE WHEN [dim_milestone].[milestone_kind] = N'first-subject-in' THEN CONVERT(DATE, CAST([f].[actual_date_key] AS CHAR(8)), 112) END) AS [from_date],
    MAX(CASE WHEN [dim_milestone].[milestone_kind] = N'last-subject-in' THEN CONVERT(DATE, CAST([f].[actual_date_key] AS CHAR(8)), 112) END) AS [to_date]
  FROM [gold].[fct_milestone] AS [f]
  JOIN [gold].[dim_milestone] AS [dim_milestone] ON [dim_milestone].[milestone_key] = [f].[milestone_key]
  WHERE [f].[actual_date_key] IS NOT NULL
  GROUP BY [f].[study_key]
)
SELECT
  [dim_study].[study_id] AS [study],
  [dim_study].[phase] AS [phase],
  CAST(DATEDIFF(DAY, [s].[from_date], [s].[to_date]) AS FLOAT) AS [value]
FROM [span] AS [s]
JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [s].[study_key]
WHERE [s].[from_date] IS NOT NULL
  AND [s].[to_date] IS NOT NULL
ORDER BY 1, 2;

-- Last subject last visit to database lock: lplv_to_dbl_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study. Filters: none.
WITH [span] AS (
  SELECT
    [f].[study_key],
    MAX(CASE WHEN [dim_milestone].[milestone_kind] = N'last-subject-last-visit' THEN CONVERT(DATE, CAST([f].[actual_date_key] AS CHAR(8)), 112) END) AS [from_date],
    MAX(CASE WHEN [dim_milestone].[milestone_kind] = N'database-lock' THEN CONVERT(DATE, CAST([f].[actual_date_key] AS CHAR(8)), 112) END) AS [to_date]
  FROM [gold].[fct_milestone] AS [f]
  JOIN [gold].[dim_milestone] AS [dim_milestone] ON [dim_milestone].[milestone_key] = [f].[milestone_key]
  WHERE [f].[actual_date_key] IS NOT NULL
  GROUP BY [f].[study_key]
)
SELECT
  [dim_study].[study_id] AS [study],
  CAST(DATEDIFF(DAY, [s].[from_date], [s].[to_date]) AS FLOAT) AS [value]
FROM [span] AS [s]
JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [s].[study_key]
WHERE [s].[from_date] IS NOT NULL
  AND [s].[to_date] IS NOT NULL
ORDER BY 1;

-- Last subject last visit to database lock: lplv_to_dbl_days 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, phase. Filters: none.
WITH [span] AS (
  SELECT
    [f].[study_key],
    MAX(CASE WHEN [dim_milestone].[milestone_kind] = N'last-subject-last-visit' THEN CONVERT(DATE, CAST([f].[actual_date_key] AS CHAR(8)), 112) END) AS [from_date],
    MAX(CASE WHEN [dim_milestone].[milestone_kind] = N'database-lock' THEN CONVERT(DATE, CAST([f].[actual_date_key] AS CHAR(8)), 112) END) AS [to_date]
  FROM [gold].[fct_milestone] AS [f]
  JOIN [gold].[dim_milestone] AS [dim_milestone] ON [dim_milestone].[milestone_key] = [f].[milestone_key]
  WHERE [f].[actual_date_key] IS NOT NULL
  GROUP BY [f].[study_key]
)
SELECT
  [dim_study].[study_id] AS [study],
  [dim_study].[phase] AS [phase],
  CAST(DATEDIFF(DAY, [s].[from_date], [s].[to_date]) AS FLOAT) AS [value]
FROM [span] AS [s]
JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [s].[study_key]
WHERE [s].[from_date] IS NOT NULL
  AND [s].[to_date] IS NOT NULL
ORDER BY 1, 2;

-- Budget burn vs plan: budget_burn_vs_plan 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [numerator] AS (
  SELECT
    SUM(CAST([f].[actual_usd] AS FLOAT)) AS [value]
  FROM [gold].[fct_spend] AS [f]
),
[denominator] AS (
  SELECT
    SUM(CAST([f].[budget_usd] AS FLOAT)) AS [value]
  FROM [gold].[fct_spend] AS [f]
)
SELECT CAST(COALESCE((SELECT [value] FROM [numerator]), 0) AS FLOAT) / NULLIF(CAST(COALESCE((SELECT [value] FROM [denominator]), 0) AS FLOAT), 0) AS [value];

-- Budget burn vs plan: budget_burn_vs_plan 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, month. Filters: none.
WITH [numerator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    SUM(CAST([f].[actual_usd] AS FLOAT)) AS [value]
  FROM [gold].[fct_spend] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[month_date_key]
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
),
[denominator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_date].[year_month] AS [month],
    SUM(CAST([f].[budget_usd] AS FLOAT)) AS [value]
  FROM [gold].[fct_spend] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  JOIN [gold].[dim_date] AS [dim_date] ON [dim_date].[date_key] = [f].[month_date_key]
  GROUP BY [dim_study].[study_id], [dim_date].[year_month]
)
SELECT
  COALESCE([n].[study], [d].[study]) AS [study],
  COALESCE([n].[month], [d].[month]) AS [month],
  CAST(COALESCE([n].[value], 0) AS FLOAT) / NULLIF(CAST(COALESCE([d].[value], 0) AS FLOAT), 0) AS [value]
FROM [numerator] AS [n]
FULL OUTER JOIN [denominator] AS [d]
  ON [d].[study] = [n].[study] AND [d].[month] = [n].[month]
ORDER BY 1, 2;

-- Cost per enrolled subject: cost_per_enrolled_subject 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: none. Filters: none.
WITH [numerator] AS (
  SELECT
    SUM(CAST([f].[actual_usd] AS FLOAT)) AS [value]
  FROM [gold].[fct_spend] AS [f]
),
[denominator] AS (
  SELECT
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  WHERE [f].[event_type] = N'enrolled'
)
SELECT CAST(COALESCE((SELECT [value] FROM [numerator]), 0) AS FLOAT) / NULLIF(CAST(COALESCE((SELECT [value] FROM [denominator]), 0) AS FLOAT), 0) AS [value];

-- Cost per enrolled subject: cost_per_enrolled_subject 1.0.0 (certified), SQL Server T-SQL.
-- Grouped by: study, phase. Filters: none.
WITH [numerator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_study].[phase] AS [phase],
    SUM(CAST([f].[actual_usd] AS FLOAT)) AS [value]
  FROM [gold].[fct_spend] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  GROUP BY [dim_study].[study_id], [dim_study].[phase]
),
[denominator] AS (
  SELECT
    [dim_study].[study_id] AS [study],
    [dim_study].[phase] AS [phase],
    COUNT(*) AS [value]
  FROM [gold].[fct_enrollment] AS [f]
  JOIN [gold].[dim_study] AS [dim_study] ON [dim_study].[study_key] = [f].[study_key]
  WHERE [f].[event_type] = N'enrolled'
  GROUP BY [dim_study].[study_id], [dim_study].[phase]
)
SELECT
  COALESCE([n].[study], [d].[study]) AS [study],
  COALESCE([n].[phase], [d].[phase]) AS [phase],
  CAST(COALESCE([n].[value], 0) AS FLOAT) / NULLIF(CAST(COALESCE([d].[value], 0) AS FLOAT), 0) AS [value]
FROM [numerator] AS [n]
FULL OUTER JOIN [denominator] AS [d]
  ON [d].[study] = [n].[study] AND [d].[phase] = [n].[phase]
ORDER BY 1, 2;
