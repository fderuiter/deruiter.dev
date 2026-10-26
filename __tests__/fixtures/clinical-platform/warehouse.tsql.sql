-- Clinical Data Platform warehouse, schema 1.7.0, SQL Server T-SQL dialect.
-- Generated from WAREHOUSE_SCHEMA in lib/clinical-platform; do not edit by hand.
-- Synthetic data for demonstration. Every study, site, subject and vendor is fictional.

IF SCHEMA_ID(N'silver') IS NULL EXEC(N'CREATE SCHEMA [silver]');
IF SCHEMA_ID(N'gold') IS NULL EXEC(N'CREATE SCHEMA [gold]');
GO

CREATE TABLE [silver].[study] (
  [study_id]              NVARCHAR(64) NOT NULL,
  [study_title]           NVARCHAR(200) NOT NULL,
  [therapeutic_area]      NVARCHAR(64) NOT NULL,
  [product_type]          NVARCHAR(64) NOT NULL,
  [phase]                 NVARCHAR(64) NOT NULL,
  [regulatory_path]       NVARCHAR(64) NOT NULL,
  [operating_model]       NVARCHAR(64) NOT NULL,
  [cro_vendor_id]         NVARCHAR(64),
  [study_status]          NVARCHAR(64) NOT NULL,
  [start_on]              DATE NOT NULL,
  [planned_enrollment]    INT NOT NULL,
  [is_randomized]         BIT NOT NULL,
  [arm_count]             INT NOT NULL,
  [schedule_source]       NVARCHAR(64) NOT NULL,
  [has_cec_adjudication]  BIT NOT NULL,
  [study_data_product_id] NVARCHAR(64),
  [is_synthetic]          BIT NOT NULL,
  CONSTRAINT [pk_study] PRIMARY KEY ([study_id])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Studies in the portfolio, one row per protocol. Grain: One row per study.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id, for example DEMO-301.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Short title.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study',
  @level2type = N'COLUMN', @level2name = N'study_title';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Therapeutic area.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study',
  @level2type = N'COLUMN', @level2name = N'therapeutic_area';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Investigational product type: drug, biologic or device.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study',
  @level2type = N'COLUMN', @level2name = N'product_type';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Development phase or device study stage.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study',
  @level2type = N'COLUMN', @level2name = N'phase';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'US regulatory pathway, IND or IDE.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study',
  @level2type = N'COLUMN', @level2name = N'regulatory_path';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Who runs the study: sponsor or CRO.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study',
  @level2type = N'COLUMN', @level2name = N'operating_model';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Vendor id of the CRO, for CRO-run studies.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study',
  @level2type = N'COLUMN', @level2name = N'cro_vendor_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Lifecycle status at the data cut.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study',
  @level2type = N'COLUMN', @level2name = N'study_status';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the protocol was finalised.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study',
  @level2type = N'COLUMN', @level2name = N'start_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Enrollment target across all sites.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study',
  @level2type = N'COLUMN', @level2name = N'planned_enrollment';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Whether subjects are randomised through IRT.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study',
  @level2type = N'COLUMN', @level2name = N'is_randomized';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Number of treatment arms.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study',
  @level2type = N'COLUMN', @level2name = N'arm_count';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Where the visit schedule comes from: usdm or blueprint.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study',
  @level2type = N'COLUMN', @level2name = N'schedule_source';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Whether a clinical events committee adjudicates events.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study',
  @level2type = N'COLUMN', @level2name = N'has_cec_adjudication';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Study Data Pipeline product that supplies the study''s SDTM and ADaM.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study',
  @level2type = N'COLUMN', @level2name = N'study_data_product_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'study',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [silver].[planned_visit] (
  [study_id]          NVARCHAR(64) NOT NULL,
  [planned_visit_id]  NVARCHAR(64) NOT NULL,
  [visit_sequence]    INT NOT NULL,
  [visit_name]        NVARCHAR(64) NOT NULL,
  [planned_day]       INT NOT NULL,
  [window_days]       INT NOT NULL,
  [dispenses_product] BIT NOT NULL,
  [is_synthetic]      BIT NOT NULL,
  CONSTRAINT [pk_planned_visit] PRIMARY KEY ([study_id], [planned_visit_id])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Planned visit schedule of each study. Grain: One row per study and planned visit.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'planned_visit';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'planned_visit',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Planned visit id within the study.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'planned_visit',
  @level2type = N'COLUMN', @level2name = N'planned_visit_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Position of the visit in the schedule, from 1.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'planned_visit',
  @level2type = N'COLUMN', @level2name = N'visit_sequence';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Display name of the visit.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'planned_visit',
  @level2type = N'COLUMN', @level2name = N'visit_name';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Planned day relative to enrollment, which is day 0.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'planned_visit',
  @level2type = N'COLUMN', @level2name = N'planned_day';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Allowed deviation from the planned day, either side.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'planned_visit',
  @level2type = N'COLUMN', @level2name = N'window_days';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Whether investigational product is dispensed.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'planned_visit',
  @level2type = N'COLUMN', @level2name = N'dispenses_product';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'planned_visit',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [silver].[site] (
  [site_id]            NVARCHAR(64) NOT NULL,
  [study_id]           NVARCHAR(64) NOT NULL,
  [site_number]        NVARCHAR(64) NOT NULL,
  [country_code]       NVARCHAR(2) NOT NULL,
  [site_name]          NVARCHAR(120) NOT NULL,
  [planned_enrollment] INT NOT NULL,
  [selected_on]        DATE,
  [contracted_on]      DATE,
  [irb_approved_on]    DATE,
  [activated_on]       DATE,
  [is_synthetic]       BIT NOT NULL,
  CONSTRAINT [pk_site] PRIMARY KEY ([site_id]),
  CONSTRAINT [ck_site_contracted_on] CHECK ([contracted_on] IS NULL OR ([selected_on] IS NOT NULL AND [selected_on] <= [contracted_on])),
  CONSTRAINT [ck_site_irb_approved_on] CHECK ([irb_approved_on] IS NULL OR ([contracted_on] IS NOT NULL AND [contracted_on] <= [irb_approved_on])),
  CONSTRAINT [ck_site_activated_on] CHECK ([activated_on] IS NULL OR ([irb_approved_on] IS NOT NULL AND [irb_approved_on] <= [activated_on]))
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Investigator sites, one row per site in one study. Grain: One row per site.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'site';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site id, unique within the portfolio.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'site',
  @level2type = N'COLUMN', @level2name = N'site_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'site',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site number within the study.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'site',
  @level2type = N'COLUMN', @level2name = N'site_number';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'ISO 3166-1 alpha-2 country code, upper case.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'site',
  @level2type = N'COLUMN', @level2name = N'country_code';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Fictional site name.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'site',
  @level2type = N'COLUMN', @level2name = N'site_name';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Enrollment target for the site.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'site',
  @level2type = N'COLUMN', @level2name = N'planned_enrollment';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the sponsor selected the site, or null before then.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'site',
  @level2type = N'COLUMN', @level2name = N'selected_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the clinical trial agreement was executed, or null before then.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'site',
  @level2type = N'COLUMN', @level2name = N'contracted_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the IRB or ethics committee approved the study at the site, or null before then.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'site',
  @level2type = N'COLUMN', @level2name = N'irb_approved_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Activation date, or null before activation.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'site',
  @level2type = N'COLUMN', @level2name = N'activated_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'site',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [silver].[vendor] (
  [vendor_id]    NVARCHAR(64) NOT NULL,
  [vendor_name]  NVARCHAR(120) NOT NULL,
  [service]      NVARCHAR(64) NOT NULL,
  [is_synthetic] BIT NOT NULL,
  CONSTRAINT [pk_vendor] PRIMARY KEY ([vendor_id])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Fictional vendors the studies use. Grain: One row per vendor.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'vendor';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Vendor id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'vendor',
  @level2type = N'COLUMN', @level2name = N'vendor_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Fictional vendor name.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'vendor',
  @level2type = N'COLUMN', @level2name = N'vendor_name';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Service the vendor provides.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'vendor',
  @level2type = N'COLUMN', @level2name = N'service';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'vendor',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [silver].[edc_subject] (
  [subject_id]            NVARCHAR(64) NOT NULL,
  [study_id]              NVARCHAR(64) NOT NULL,
  [site_id]               NVARCHAR(64) NOT NULL,
  [screened_on]           DATE NOT NULL,
  [enrolled_on]           DATE,
  [completed_on]          DATE,
  [discontinued_on]       DATE,
  [subject_status]        NVARCHAR(64) NOT NULL,
  [screen_failure_reason] NVARCHAR(40),
  [source_system]         NVARCHAR(64) NOT NULL,
  [is_synthetic]          BIT NOT NULL,
  CONSTRAINT [pk_edc_subject] PRIMARY KEY ([subject_id])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'EDC subjects with their screening, enrollment and disposition dates. Grain: One row per subject.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_subject';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Subject id, unique within the portfolio.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_subject',
  @level2type = N'COLUMN', @level2name = N'subject_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_subject',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_subject',
  @level2type = N'COLUMN', @level2name = N'site_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date of the screening visit.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_subject',
  @level2type = N'COLUMN', @level2name = N'screened_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Enrollment date, or null when not enrolled.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_subject',
  @level2type = N'COLUMN', @level2name = N'enrolled_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the subject completed the study.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_subject',
  @level2type = N'COLUMN', @level2name = N'completed_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the subject discontinued.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_subject',
  @level2type = N'COLUMN', @level2name = N'discontinued_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Status at the data cut.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_subject',
  @level2type = N'COLUMN', @level2name = N'subject_status';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Why screening failed, from a short fictional controlled list; null unless the subject failed screening.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_subject',
  @level2type = N'COLUMN', @level2name = N'screen_failure_reason';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Source system the record came from.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_subject',
  @level2type = N'COLUMN', @level2name = N'source_system';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_subject',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [silver].[edc_visit] (
  [visit_id]         NVARCHAR(64) NOT NULL,
  [subject_id]       NVARCHAR(64) NOT NULL,
  [study_id]         NVARCHAR(64) NOT NULL,
  [site_id]          NVARCHAR(64) NOT NULL,
  [planned_visit_id] NVARCHAR(64) NOT NULL,
  [visit_date]       DATE,
  [day_offset]       INT,
  [data_entered_at]  DATETIMEOFFSET(0),
  [visit_status]     NVARCHAR(64) NOT NULL,
  [source_system]    NVARCHAR(64) NOT NULL,
  [is_synthetic]     BIT NOT NULL,
  CONSTRAINT [pk_edc_visit] PRIMARY KEY ([visit_id])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'EDC visit records with their data entry times. Grain: One row per subject visit record.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_visit';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Visit record id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_visit',
  @level2type = N'COLUMN', @level2name = N'visit_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Subject id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_visit',
  @level2type = N'COLUMN', @level2name = N'subject_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_visit',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_visit',
  @level2type = N'COLUMN', @level2name = N'site_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Planned visit id from the schedule.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_visit',
  @level2type = N'COLUMN', @level2name = N'planned_visit_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Visit date, or null for a missed visit.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_visit',
  @level2type = N'COLUMN', @level2name = N'visit_date';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Actual minus planned day, or null for a missed visit.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_visit',
  @level2type = N'COLUMN', @level2name = N'day_offset';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'UTC time the site entered the visit''s data.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_visit',
  @level2type = N'COLUMN', @level2name = N'data_entered_at';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Entry state: entered, pending-entry or missed.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_visit',
  @level2type = N'COLUMN', @level2name = N'visit_status';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Source system the record came from.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_visit',
  @level2type = N'COLUMN', @level2name = N'source_system';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_visit',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [silver].[edc_query] (
  [query_id]      NVARCHAR(64) NOT NULL,
  [visit_id]      NVARCHAR(64) NOT NULL,
  [subject_id]    NVARCHAR(64) NOT NULL,
  [study_id]      NVARCHAR(64) NOT NULL,
  [site_id]       NVARCHAR(64) NOT NULL,
  [queried_field] NVARCHAR(64) NOT NULL,
  [query_origin]  NVARCHAR(64) NOT NULL,
  [opened_at]     DATETIMEOFFSET(0) NOT NULL,
  [answered_at]   DATETIMEOFFSET(0),
  [closed_at]     DATETIMEOFFSET(0),
  [query_status]  NVARCHAR(64) NOT NULL,
  [source_system] NVARCHAR(64) NOT NULL,
  [is_synthetic]  BIT NOT NULL,
  CONSTRAINT [pk_edc_query] PRIMARY KEY ([query_id])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'EDC data queries with their open, answer and close times. Grain: One row per query.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_query';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Query id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_query',
  @level2type = N'COLUMN', @level2name = N'query_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Visit record id the query is raised on.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_query',
  @level2type = N'COLUMN', @level2name = N'visit_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Subject id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_query',
  @level2type = N'COLUMN', @level2name = N'subject_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_query',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_query',
  @level2type = N'COLUMN', @level2name = N'site_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Queried field, as DOMAIN.VARIABLE.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_query',
  @level2type = N'COLUMN', @level2name = N'queried_field';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'How the query was raised: edit-check or manual.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_query',
  @level2type = N'COLUMN', @level2name = N'query_origin';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'UTC time the query was opened.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_query',
  @level2type = N'COLUMN', @level2name = N'opened_at';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'UTC time the site answered.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_query',
  @level2type = N'COLUMN', @level2name = N'answered_at';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'UTC time the query was closed.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_query',
  @level2type = N'COLUMN', @level2name = N'closed_at';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'State at the data cut.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_query',
  @level2type = N'COLUMN', @level2name = N'query_status';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Source system the record came from.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_query',
  @level2type = N'COLUMN', @level2name = N'source_system';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'edc_query',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [silver].[ctms_milestone] (
  [study_id]        NVARCHAR(64) NOT NULL,
  [milestone_kind]  NVARCHAR(64) NOT NULL,
  [milestone_label] NVARCHAR(120) NOT NULL,
  [planned_on]      DATE NOT NULL,
  [actual_on]       DATE,
  [source_system]   NVARCHAR(64) NOT NULL,
  [is_synthetic]    BIT NOT NULL,
  CONSTRAINT [pk_ctms_milestone] PRIMARY KEY ([study_id], [milestone_kind])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'CTMS study milestones, planned and actual. Grain: One row per study and milestone kind.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_milestone';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_milestone',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Milestone kind.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_milestone',
  @level2type = N'COLUMN', @level2name = N'milestone_kind';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Label in the study''s own vocabulary.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_milestone',
  @level2type = N'COLUMN', @level2name = N'milestone_label';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Planned date.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_milestone',
  @level2type = N'COLUMN', @level2name = N'planned_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Actual date, or null when not reached.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_milestone',
  @level2type = N'COLUMN', @level2name = N'actual_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Source system the record came from.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_milestone',
  @level2type = N'COLUMN', @level2name = N'source_system';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_milestone',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [silver].[ctms_monitoring_plan] (
  [monitoring_plan_id]    NVARCHAR(64) NOT NULL,
  [study_id]              NVARCHAR(64) NOT NULL,
  [plan_version]          NVARCHAR(16) NOT NULL,
  [effective_on]          DATE NOT NULL,
  [interim_interval_days] INT NOT NULL,
  [visit_window_days]     INT NOT NULL,
  [report_due_days]       INT NOT NULL,
  [source_system]         NVARCHAR(64) NOT NULL,
  [is_synthetic]          BIT NOT NULL,
  CONSTRAINT [pk_ctms_monitoring_plan] PRIMARY KEY ([monitoring_plan_id])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'CTMS monitoring plans: the interim visit cadence and report deadline each study''s plan sets. Grain: One row per monitoring plan version.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_plan';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Monitoring plan id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'monitoring_plan_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Plan version.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'plan_version';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the plan took effect.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'effective_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Planned days from one monitoring visit at a site to the next interim visit.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'interim_interval_days';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Days an interim visit may fall after its planned date and still be on time.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'visit_window_days';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Days from a visit by which its report must be final.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'report_due_days';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Source system the record came from.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'source_system';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [silver].[ctms_monitoring_visit] (
  [monitoring_visit_id] NVARCHAR(64) NOT NULL,
  [study_id]            NVARCHAR(64) NOT NULL,
  [site_id]             NVARCHAR(64) NOT NULL,
  [visit_type]          NVARCHAR(64) NOT NULL,
  [visit_mode]          NVARCHAR(64) NOT NULL,
  [visit_date]          DATE NOT NULL,
  [report_final_on]     DATE,
  [sdv_pages_due]       INT NOT NULL,
  [sdv_pages_verified]  INT NOT NULL,
  [action_items]        INT NOT NULL,
  [source_system]       NVARCHAR(64) NOT NULL,
  [is_synthetic]        BIT NOT NULL,
  CONSTRAINT [pk_ctms_monitoring_visit] PRIMARY KEY ([monitoring_visit_id])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'CTMS monitoring visits with source data verification counts. Grain: One row per monitoring visit.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_visit';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Monitoring visit id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'monitoring_visit_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'site_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'SIV, IMV or COV.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'visit_type';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'On-site or remote.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'visit_mode';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Visit date.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'visit_date';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the visit report was finalised.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'report_final_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'CRF pages due for source data verification.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'sdv_pages_due';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'CRF pages source-verified.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'sdv_pages_verified';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Action items raised.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'action_items';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Source system the record came from.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'source_system';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [silver].[ctms_deviation] (
  [deviation_id]       NVARCHAR(64) NOT NULL,
  [study_id]           NVARCHAR(64) NOT NULL,
  [site_id]            NVARCHAR(64) NOT NULL,
  [subject_id]         NVARCHAR(64) NOT NULL,
  [deviation_category] NVARCHAR(80) NOT NULL,
  [importance]         NVARCHAR(64) NOT NULL,
  [occurred_on]        DATE NOT NULL,
  [identified_on]      DATE NOT NULL,
  [source_system]      NVARCHAR(64) NOT NULL,
  [is_synthetic]       BIT NOT NULL,
  CONSTRAINT [pk_ctms_deviation] PRIMARY KEY ([deviation_id])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol deviations logged in CTMS. Grain: One row per deviation.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_deviation';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Deviation id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_deviation',
  @level2type = N'COLUMN', @level2name = N'deviation_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_deviation',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_deviation',
  @level2type = N'COLUMN', @level2name = N'site_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Subject id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_deviation',
  @level2type = N'COLUMN', @level2name = N'subject_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Deviation category.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_deviation',
  @level2type = N'COLUMN', @level2name = N'deviation_category';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Importance per ICH E3: important or not-important.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_deviation',
  @level2type = N'COLUMN', @level2name = N'importance';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the deviation occurred.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_deviation',
  @level2type = N'COLUMN', @level2name = N'occurred_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the deviation was identified.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_deviation',
  @level2type = N'COLUMN', @level2name = N'identified_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Source system the record came from.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_deviation',
  @level2type = N'COLUMN', @level2name = N'source_system';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_deviation',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [silver].[ctms_site_staff] (
  [assignment_id]   NVARCHAR(64) NOT NULL,
  [study_id]        NVARCHAR(64) NOT NULL,
  [site_id]         NVARCHAR(64) NOT NULL,
  [staff_role]      NVARCHAR(64) NOT NULL,
  [investigator_id] NVARCHAR(64) NOT NULL,
  [start_on]        DATE NOT NULL,
  [end_on]          DATE,
  [source_system]   NVARCHAR(64) NOT NULL,
  [is_synthetic]    BIT NOT NULL,
  CONSTRAINT [pk_ctms_site_staff] PRIMARY KEY ([assignment_id]),
  CONSTRAINT [uq_ctms_site_staff_1] UNIQUE ([site_id], [start_on])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Principal investigator assignments per site, from the CTMS site staff feed. Grain: One row per site staff assignment.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_site_staff';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Assignment id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_site_staff',
  @level2type = N'COLUMN', @level2name = N'assignment_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_site_staff',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_site_staff',
  @level2type = N'COLUMN', @level2name = N'site_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Staff role.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_site_staff',
  @level2type = N'COLUMN', @level2name = N'staff_role';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Fictional investigator id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_site_staff',
  @level2type = N'COLUMN', @level2name = N'investigator_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'First day in the role.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_site_staff',
  @level2type = N'COLUMN', @level2name = N'start_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Last day in the role, or null while still in it.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_site_staff',
  @level2type = N'COLUMN', @level2name = N'end_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Source system the record came from.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_site_staff',
  @level2type = N'COLUMN', @level2name = N'source_system';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'ctms_site_staff',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [silver].[irt_randomization] (
  [randomization_id] NVARCHAR(64) NOT NULL,
  [subject_id]       NVARCHAR(64) NOT NULL,
  [study_id]         NVARCHAR(64) NOT NULL,
  [site_id]          NVARCHAR(64) NOT NULL,
  [randomized_at]    DATETIMEOFFSET(0) NOT NULL,
  [arm]              NVARCHAR(80) NOT NULL,
  [source_system]    NVARCHAR(64) NOT NULL,
  [is_synthetic]     BIT NOT NULL,
  CONSTRAINT [pk_irt_randomization] PRIMARY KEY ([randomization_id]),
  CONSTRAINT [uq_irt_randomization_1] UNIQUE ([subject_id])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'IRT randomisations. The arm is restricted to unblinded roles. Grain: One row per randomisation.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_randomization';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Randomisation number.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_randomization',
  @level2type = N'COLUMN', @level2name = N'randomization_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Subject id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_randomization',
  @level2type = N'COLUMN', @level2name = N'subject_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_randomization',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_randomization',
  @level2type = N'COLUMN', @level2name = N'site_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'UTC time of randomisation.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_randomization',
  @level2type = N'COLUMN', @level2name = N'randomized_at';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Assigned arm. Blinded consumers must not read it.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_randomization',
  @level2type = N'COLUMN', @level2name = N'arm';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Source system the record came from.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_randomization',
  @level2type = N'COLUMN', @level2name = N'source_system';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_randomization',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [silver].[irt_kit] (
  [kit_id]        NVARCHAR(64) NOT NULL,
  [study_id]      NVARCHAR(64) NOT NULL,
  [site_id]       NVARCHAR(64) NOT NULL,
  [subject_id]    NVARCHAR(64),
  [received_on]   DATE NOT NULL,
  [dispensed_on]  DATE,
  [expires_on]    DATE NOT NULL,
  [kit_status]    NVARCHAR(64) NOT NULL,
  [source_system] NVARCHAR(64) NOT NULL,
  [is_synthetic]  BIT NOT NULL,
  CONSTRAINT [pk_irt_kit] PRIMARY KEY ([kit_id])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'IRT investigational product kits. Grain: One row per kit.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_kit';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Kit number.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_kit',
  @level2type = N'COLUMN', @level2name = N'kit_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_kit',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site holding the kit.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_kit',
  @level2type = N'COLUMN', @level2name = N'site_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Subject the kit was dispensed to.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_kit',
  @level2type = N'COLUMN', @level2name = N'subject_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the site received the kit.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_kit',
  @level2type = N'COLUMN', @level2name = N'received_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Dispensing date.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_kit',
  @level2type = N'COLUMN', @level2name = N'dispensed_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Expiry date.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_kit',
  @level2type = N'COLUMN', @level2name = N'expires_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'State at the data cut.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_kit',
  @level2type = N'COLUMN', @level2name = N'kit_status';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Source system the record came from.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_kit',
  @level2type = N'COLUMN', @level2name = N'source_system';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'irt_kit',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [silver].[etmf_document] (
  [document_id]     NVARCHAR(64) NOT NULL,
  [study_id]        NVARCHAR(64) NOT NULL,
  [site_id]         NVARCHAR(64),
  [tmf_zone]        NVARCHAR(80) NOT NULL,
  [artifact]        NVARCHAR(120) NOT NULL,
  [due_on]          DATE NOT NULL,
  [filed_on]        DATE,
  [document_status] NVARCHAR(64) NOT NULL,
  [source_system]   NVARCHAR(64) NOT NULL,
  [is_synthetic]    BIT NOT NULL,
  CONSTRAINT [pk_etmf_document] PRIMARY KEY ([document_id])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'eTMF expected documents, filed against the TMF Reference Model. Grain: One row per expected document.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'etmf_document';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Document id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'etmf_document',
  @level2type = N'COLUMN', @level2name = N'document_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'etmf_document',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site id, or null for a trial-level document.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'etmf_document',
  @level2type = N'COLUMN', @level2name = N'site_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'TMF Reference Model zone.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'etmf_document',
  @level2type = N'COLUMN', @level2name = N'tmf_zone';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Artifact name.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'etmf_document',
  @level2type = N'COLUMN', @level2name = N'artifact';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the document is due.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'etmf_document',
  @level2type = N'COLUMN', @level2name = N'due_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Filing date.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'etmf_document',
  @level2type = N'COLUMN', @level2name = N'filed_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Filed, missing or expected.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'etmf_document',
  @level2type = N'COLUMN', @level2name = N'document_status';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Source system the record came from.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'etmf_document',
  @level2type = N'COLUMN', @level2name = N'source_system';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'etmf_document',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [silver].[finance_line] (
  [study_id]         NVARCHAR(64) NOT NULL,
  [vendor_id]        NVARCHAR(64),
  [cost_category]    NVARCHAR(64) NOT NULL,
  [fiscal_quarter]   NVARCHAR(7) NOT NULL,
  [quarter_start_on] DATE NOT NULL,
  [budget_usd]       INT NOT NULL,
  [actual_usd]       INT NOT NULL,
  [source_system]    NVARCHAR(64) NOT NULL,
  [is_synthetic]     BIT NOT NULL,
  CONSTRAINT [pk_finance_line] PRIMARY KEY ([study_id], [cost_category], [fiscal_quarter])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Budget against actual per study, cost category and calendar quarter. Grain: One row per study, cost category and quarter.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_line';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_line',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Vendor id, or null for investigator grants.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_line',
  @level2type = N'COLUMN', @level2name = N'vendor_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Cost category.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_line',
  @level2type = N'COLUMN', @level2name = N'cost_category';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Calendar quarter, for example 2026-Q3.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_line',
  @level2type = N'COLUMN', @level2name = N'fiscal_quarter';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'First day of the quarter.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_line',
  @level2type = N'COLUMN', @level2name = N'quarter_start_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Budgeted amount, whole US dollars.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_line',
  @level2type = N'COLUMN', @level2name = N'budget_usd';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Actual spend, whole US dollars.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_line',
  @level2type = N'COLUMN', @level2name = N'actual_usd';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Source system the record came from.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_line',
  @level2type = N'COLUMN', @level2name = N'source_system';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_line',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [silver].[finance_plan_line] (
  [study_id]         NVARCHAR(64) NOT NULL,
  [vendor_id]        NVARCHAR(64),
  [cost_category]    NVARCHAR(64) NOT NULL,
  [fiscal_quarter]   NVARCHAR(7) NOT NULL,
  [quarter_start_on] DATE NOT NULL,
  [budget_usd]       INT NOT NULL,
  [source_system]    NVARCHAR(64) NOT NULL,
  [is_synthetic]     BIT NOT NULL,
  CONSTRAINT [pk_finance_plan_line] PRIMARY KEY ([study_id], [cost_category], [fiscal_quarter])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'The approved budget plan per study, cost category and calendar quarter, from the study''s start to its planned final report. Grain: One row per study, cost category and quarter.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_plan_line';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_plan_line',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Vendor id, or null for investigator grants.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_plan_line',
  @level2type = N'COLUMN', @level2name = N'vendor_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Cost category.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_plan_line',
  @level2type = N'COLUMN', @level2name = N'cost_category';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Calendar quarter, for example 2027-Q1.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_plan_line',
  @level2type = N'COLUMN', @level2name = N'fiscal_quarter';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'First day of the quarter.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_plan_line',
  @level2type = N'COLUMN', @level2name = N'quarter_start_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Planned budget, whole US dollars.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_plan_line',
  @level2type = N'COLUMN', @level2name = N'budget_usd';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Source system the record came from.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_plan_line',
  @level2type = N'COLUMN', @level2name = N'source_system';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'finance_plan_line',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [silver].[cec_adjudication] (
  [event_id]            NVARCHAR(64) NOT NULL,
  [study_id]            NVARCHAR(64) NOT NULL,
  [site_id]             NVARCHAR(64) NOT NULL,
  [subject_id]          NVARCHAR(64) NOT NULL,
  [site_event_type]     NVARCHAR(80) NOT NULL,
  [site_device_related] BIT NOT NULL,
  [occurred_on]         DATE NOT NULL,
  [reported_on]         DATE NOT NULL,
  [adjudicated_on]      DATE,
  [cec_event_type]      NVARCHAR(80),
  [cec_device_related]  BIT,
  [source_system]       NVARCHAR(64) NOT NULL,
  [is_synthetic]        BIT NOT NULL,
  CONSTRAINT [pk_cec_adjudication] PRIMARY KEY ([event_id]),
  CONSTRAINT [ck_cec_adjudication_reported_on] CHECK ([reported_on] IS NULL OR ([occurred_on] IS NOT NULL AND [occurred_on] <= [reported_on])),
  CONSTRAINT [ck_cec_adjudication_adjudicated_on] CHECK ([adjudicated_on] IS NULL OR ([reported_on] IS NOT NULL AND [reported_on] <= [adjudicated_on]))
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Clinical events committee adjudications of site-reported events. Grain: One row per adjudicated event.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'cec_adjudication';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Event id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'event_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'site_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Subject id.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'subject_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Event type as reported by the site.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'site_event_type';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Whether the site judged the event device-related.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'site_device_related';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the event occurred.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'occurred_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the site reported the event.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'reported_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Adjudication date, or null while pending.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'adjudicated_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Event type as adjudicated.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'cec_event_type';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Whether the committee judged the event device-related.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'cec_device_related';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Source system the record came from.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'source_system';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'silver',
  @level1type = N'TABLE', @level1name = N'cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [gold].[dim_study] (
  [study_key]             INT NOT NULL,
  [study_id]              NVARCHAR(64) NOT NULL,
  [study_title]           NVARCHAR(200) NOT NULL,
  [therapeutic_area]      NVARCHAR(64) NOT NULL,
  [product_type]          NVARCHAR(64) NOT NULL,
  [phase]                 NVARCHAR(64) NOT NULL,
  [regulatory_path]       NVARCHAR(64) NOT NULL,
  [operating_model]       NVARCHAR(64) NOT NULL,
  [cro_vendor_id]         NVARCHAR(64),
  [study_status]          NVARCHAR(64) NOT NULL,
  [start_on]              DATE NOT NULL,
  [planned_enrollment]    INT NOT NULL,
  [is_randomized]         BIT NOT NULL,
  [arm_count]             INT NOT NULL,
  [has_cec_adjudication]  BIT NOT NULL,
  [study_data_product_id] NVARCHAR(64),
  [is_synthetic]          BIT NOT NULL,
  CONSTRAINT [pk_dim_study] PRIMARY KEY ([study_key]),
  CONSTRAINT [uq_dim_study_1] UNIQUE ([study_id])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Conformed study dimension. Grain: One row per study.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Surrogate key.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study',
  @level2type = N'COLUMN', @level2name = N'study_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id, the natural key.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Short title.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study',
  @level2type = N'COLUMN', @level2name = N'study_title';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Therapeutic area.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study',
  @level2type = N'COLUMN', @level2name = N'therapeutic_area';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Investigational product type.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study',
  @level2type = N'COLUMN', @level2name = N'product_type';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Development phase or device study stage.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study',
  @level2type = N'COLUMN', @level2name = N'phase';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'IND or IDE.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study',
  @level2type = N'COLUMN', @level2name = N'regulatory_path';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Sponsor or CRO.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study',
  @level2type = N'COLUMN', @level2name = N'operating_model';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Vendor id of the CRO.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study',
  @level2type = N'COLUMN', @level2name = N'cro_vendor_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Lifecycle status at the data cut.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study',
  @level2type = N'COLUMN', @level2name = N'study_status';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the protocol was finalised.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study',
  @level2type = N'COLUMN', @level2name = N'start_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Enrollment target.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study',
  @level2type = N'COLUMN', @level2name = N'planned_enrollment';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Whether subjects are randomised.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study',
  @level2type = N'COLUMN', @level2name = N'is_randomized';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Number of treatment arms.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study',
  @level2type = N'COLUMN', @level2name = N'arm_count';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Whether a clinical events committee adjudicates events.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study',
  @level2type = N'COLUMN', @level2name = N'has_cec_adjudication';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Study Data Pipeline product id.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study',
  @level2type = N'COLUMN', @level2name = N'study_data_product_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_study',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [gold].[dim_site] (
  [site_key]                  INT NOT NULL,
  [site_id]                   NVARCHAR(64) NOT NULL,
  [version_number]            INT NOT NULL,
  [study_id]                  NVARCHAR(64) NOT NULL,
  [site_number]               NVARCHAR(64) NOT NULL,
  [site_name]                 NVARCHAR(120) NOT NULL,
  [country_code]              NVARCHAR(2) NOT NULL,
  [planned_enrollment]        INT NOT NULL,
  [selected_on]               DATE,
  [contracted_on]             DATE,
  [irb_approved_on]           DATE,
  [initiated_on]              DATE,
  [activated_on]              DATE,
  [first_subject_in_on]       DATE,
  [site_status]               NVARCHAR(64) NOT NULL,
  [principal_investigator_id] NVARCHAR(64),
  [valid_from]                DATE NOT NULL,
  [valid_to]                  DATE NOT NULL,
  [is_current]                BIT NOT NULL,
  [is_synthetic]              BIT NOT NULL,
  CONSTRAINT [pk_dim_site] PRIMARY KEY ([site_key]),
  CONSTRAINT [uq_dim_site_1] UNIQUE ([site_id], [version_number]),
  CONSTRAINT [uq_dim_site_2] UNIQUE ([site_id], [valid_from]),
  CONSTRAINT [ck_dim_site_contracted_on] CHECK ([contracted_on] IS NULL OR ([selected_on] IS NOT NULL AND [selected_on] <= [contracted_on])),
  CONSTRAINT [ck_dim_site_irb_approved_on] CHECK ([irb_approved_on] IS NULL OR ([contracted_on] IS NOT NULL AND [contracted_on] <= [irb_approved_on])),
  CONSTRAINT [ck_dim_site_initiated_on] CHECK ([initiated_on] IS NULL OR ([irb_approved_on] IS NOT NULL AND [irb_approved_on] <= [initiated_on])),
  CONSTRAINT [ck_dim_site_activated_on] CHECK ([activated_on] IS NULL OR ([initiated_on] IS NOT NULL AND [initiated_on] <= [activated_on])),
  CONSTRAINT [ck_dim_site_first_subject_in_on] CHECK ([first_subject_in_on] IS NULL OR ([activated_on] IS NOT NULL AND [activated_on] <= [first_subject_in_on]))
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Conformed site dimension, slowly changing type 2 on site status and principal investigator. Grain: One row per site version: a new row each time the status or the principal investigator changes.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Surrogate key of the version.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'site_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site id, the natural key.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'site_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Version of the site, from 1.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'version_number';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site number within the study.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'site_number';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Fictional site name.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'site_name';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'ISO 3166-1 alpha-2 country code.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'country_code';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Enrollment target for the site.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'planned_enrollment';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the site was selected (start-up stage 1).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'selected_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the clinical trial agreement was executed (stage 2).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'contracted_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the IRB or ethics committee approved the study at the site (stage 3).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'irb_approved_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date of the site initiation visit (stage 4).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'initiated_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Activation date (stage 5).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'activated_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the site enrolled its first subject (stage 6).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'first_subject_in_on';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Status during the version: start-up, active or closed.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'site_status';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Fictional id of the principal investigator during the version, or null when none is on file.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'principal_investigator_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'First day the version is in force (inclusive).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'valid_from';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Day the next version takes over (exclusive), or 9999-12-31.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'valid_to';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Whether this is the latest version.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'is_current';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_site',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [gold].[dim_country] (
  [country_key]  INT NOT NULL,
  [country_code] NVARCHAR(2) NOT NULL,
  [country_name] NVARCHAR(64) NOT NULL,
  [region]       NVARCHAR(64) NOT NULL,
  CONSTRAINT [pk_dim_country] PRIMARY KEY ([country_key]),
  CONSTRAINT [uq_dim_country_1] UNIQUE ([country_code])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Conformed country dimension. Grain: One row per country with a site.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_country';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Surrogate key.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_country',
  @level2type = N'COLUMN', @level2name = N'country_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'ISO 3166-1 alpha-2 country code.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_country',
  @level2type = N'COLUMN', @level2name = N'country_code';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'English short name.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_country',
  @level2type = N'COLUMN', @level2name = N'country_name';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Operational region.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_country',
  @level2type = N'COLUMN', @level2name = N'region';
GO

CREATE TABLE [gold].[dim_date] (
  [date_key]        INT NOT NULL,
  [calendar_date]   DATE NOT NULL,
  [year_number]     INT NOT NULL,
  [quarter_number]  INT NOT NULL,
  [month_number]    INT NOT NULL,
  [month_name]      NVARCHAR(9) NOT NULL,
  [day_of_month]    INT NOT NULL,
  [iso_day_of_week] INT NOT NULL,
  [year_month]      NVARCHAR(7) NOT NULL,
  [year_quarter]    NVARCHAR(7) NOT NULL,
  [is_month_end]    BIT NOT NULL,
  CONSTRAINT [pk_dim_date] PRIMARY KEY ([date_key]),
  CONSTRAINT [uq_dim_date_1] UNIQUE ([calendar_date])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Conformed calendar dimension, whole years around every fact date. Grain: One row per calendar day.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_date';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Smart key, YYYYMMDD.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_date',
  @level2type = N'COLUMN', @level2name = N'date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'The day.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_date',
  @level2type = N'COLUMN', @level2name = N'calendar_date';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Calendar year.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_date',
  @level2type = N'COLUMN', @level2name = N'year_number';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Calendar quarter, 1 to 4.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_date',
  @level2type = N'COLUMN', @level2name = N'quarter_number';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Calendar month, 1 to 12.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_date',
  @level2type = N'COLUMN', @level2name = N'month_number';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'English month name.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_date',
  @level2type = N'COLUMN', @level2name = N'month_name';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Day of the month.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_date',
  @level2type = N'COLUMN', @level2name = N'day_of_month';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'ISO 8601 day of the week, Monday 1 to Sunday 7.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_date',
  @level2type = N'COLUMN', @level2name = N'iso_day_of_week';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Year and month, for example 2026-09.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_date',
  @level2type = N'COLUMN', @level2name = N'year_month';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Year and quarter, for example 2026-Q3.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_date',
  @level2type = N'COLUMN', @level2name = N'year_quarter';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Whether the day is the last of its month.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_date',
  @level2type = N'COLUMN', @level2name = N'is_month_end';
GO

CREATE TABLE [gold].[dim_vendor] (
  [vendor_key]     INT NOT NULL,
  [vendor_id]      NVARCHAR(64) NOT NULL,
  [vendor_name]    NVARCHAR(120) NOT NULL,
  [vendor_service] NVARCHAR(64) NOT NULL,
  [is_synthetic]   BIT NOT NULL,
  CONSTRAINT [pk_dim_vendor] PRIMARY KEY ([vendor_key]),
  CONSTRAINT [uq_dim_vendor_1] UNIQUE ([vendor_id])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Conformed vendor dimension, with key 0 for spend that has no vendor (investigator grants). Grain: One row per vendor, plus the not-applicable member.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_vendor';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Surrogate key; 0 is the not-applicable member.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_vendor',
  @level2type = N'COLUMN', @level2name = N'vendor_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Vendor id, or N/A.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_vendor',
  @level2type = N'COLUMN', @level2name = N'vendor_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Fictional vendor name.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_vendor',
  @level2type = N'COLUMN', @level2name = N'vendor_name';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Service the vendor provides.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_vendor',
  @level2type = N'COLUMN', @level2name = N'vendor_service';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_vendor',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [gold].[dim_milestone] (
  [milestone_key]      INT NOT NULL,
  [milestone_kind]     NVARCHAR(64) NOT NULL,
  [milestone_name]     NVARCHAR(80) NOT NULL,
  [milestone_sequence] INT NOT NULL,
  CONSTRAINT [pk_dim_milestone] PRIMARY KEY ([milestone_key]),
  CONSTRAINT [uq_dim_milestone_1] UNIQUE ([milestone_kind])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Conformed milestone dimension: the milestone kinds in lifecycle order. Grain: One row per milestone kind.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_milestone';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Surrogate key.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_milestone',
  @level2type = N'COLUMN', @level2name = N'milestone_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Milestone kind.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_milestone',
  @level2type = N'COLUMN', @level2name = N'milestone_kind';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Neutral display name.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_milestone',
  @level2type = N'COLUMN', @level2name = N'milestone_name';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Position in the study lifecycle, from 1.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_milestone',
  @level2type = N'COLUMN', @level2name = N'milestone_sequence';
GO

CREATE TABLE [gold].[dim_monitoring_plan] (
  [monitoring_plan_key]   INT NOT NULL,
  [monitoring_plan_id]    NVARCHAR(64) NOT NULL,
  [study_id]              NVARCHAR(64) NOT NULL,
  [plan_version]          NVARCHAR(16) NOT NULL,
  [effective_date_key]    INT NOT NULL,
  [interim_interval_days] INT NOT NULL,
  [visit_window_days]     INT NOT NULL,
  [report_due_days]       INT NOT NULL,
  [is_synthetic]          BIT NOT NULL,
  CONSTRAINT [pk_dim_monitoring_plan] PRIMARY KEY ([monitoring_plan_key]),
  CONSTRAINT [uq_dim_monitoring_plan_1] UNIQUE ([monitoring_plan_id]),
  CONSTRAINT [fk_dim_monitoring_plan_effective_date_key] FOREIGN KEY ([effective_date_key]) REFERENCES [gold].[dim_date] ([date_key])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Monitoring plan dimension: the cadence and report deadline each study''s plan sets, which monitoring is measured against. Grain: One row per monitoring plan version.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_monitoring_plan';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Surrogate key.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'monitoring_plan_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Monitoring plan id.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'monitoring_plan_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol id.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'study_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Plan version.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'plan_version';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the plan took effect.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'effective_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Planned days from one monitoring visit at a site to the next interim visit.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'interim_interval_days';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Days an interim visit may fall after its planned date and still be on time.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'visit_window_days';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Days from a visit by which its report must be final.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'report_due_days';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'dim_monitoring_plan',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [gold].[fct_enrollment] (
  [subject_id]            NVARCHAR(64) NOT NULL,
  [event_type]            NVARCHAR(64) NOT NULL,
  [study_key]             INT NOT NULL,
  [site_key]              INT NOT NULL,
  [country_key]           INT NOT NULL,
  [event_date_key]        INT NOT NULL,
  [subject_status]        NVARCHAR(64) NOT NULL,
  [screen_failure_reason] NVARCHAR(40),
  [event_count]           INT NOT NULL,
  [is_synthetic]          BIT NOT NULL,
  CONSTRAINT [pk_fct_enrollment] PRIMARY KEY ([subject_id], [event_type]),
  CONSTRAINT [fk_fct_enrollment_study_key] FOREIGN KEY ([study_key]) REFERENCES [gold].[dim_study] ([study_key]),
  CONSTRAINT [fk_fct_enrollment_site_key] FOREIGN KEY ([site_key]) REFERENCES [gold].[dim_site] ([site_key]),
  CONSTRAINT [fk_fct_enrollment_country_key] FOREIGN KEY ([country_key]) REFERENCES [gold].[dim_country] ([country_key]),
  CONSTRAINT [fk_fct_enrollment_event_date_key] FOREIGN KEY ([event_date_key]) REFERENCES [gold].[dim_date] ([date_key])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Subject enrollment events: screened, enrolled, completed and discontinued. Grain: One row per subject per enrollment event.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_enrollment';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Subject id (degenerate dimension).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_enrollment',
  @level2type = N'COLUMN', @level2name = N'subject_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'screened, enrolled, completed or discontinued.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_enrollment',
  @level2type = N'COLUMN', @level2name = N'event_type';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Study.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_enrollment',
  @level2type = N'COLUMN', @level2name = N'study_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site version in force on the event date.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_enrollment',
  @level2type = N'COLUMN', @level2name = N'site_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Country of the site.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_enrollment',
  @level2type = N'COLUMN', @level2name = N'country_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date of the event.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_enrollment',
  @level2type = N'COLUMN', @level2name = N'event_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Subject status at the data cut.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_enrollment',
  @level2type = N'COLUMN', @level2name = N'subject_status';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Why screening failed; null unless the subject failed screening (degenerate dimension).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_enrollment',
  @level2type = N'COLUMN', @level2name = N'screen_failure_reason';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always 1: the additive measure.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_enrollment',
  @level2type = N'COLUMN', @level2name = N'event_count';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_enrollment',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [gold].[fct_visit] (
  [visit_id]         NVARCHAR(64) NOT NULL,
  [subject_id]       NVARCHAR(64) NOT NULL,
  [planned_visit_id] NVARCHAR(64) NOT NULL,
  [study_key]        INT NOT NULL,
  [site_key]         INT NOT NULL,
  [country_key]      INT NOT NULL,
  [visit_date_key]   INT,
  [planned_date_key] INT NOT NULL,
  [visit_status]     NVARCHAR(64) NOT NULL,
  [day_offset]       INT,
  [is_out_of_window] BIT NOT NULL,
  [entry_lag_days]   INT,
  [entry_hour]       INT,
  [is_synthetic]     BIT NOT NULL,
  CONSTRAINT [pk_fct_visit] PRIMARY KEY ([visit_id]),
  CONSTRAINT [fk_fct_visit_study_key] FOREIGN KEY ([study_key]) REFERENCES [gold].[dim_study] ([study_key]),
  CONSTRAINT [fk_fct_visit_site_key] FOREIGN KEY ([site_key]) REFERENCES [gold].[dim_site] ([site_key]),
  CONSTRAINT [fk_fct_visit_country_key] FOREIGN KEY ([country_key]) REFERENCES [gold].[dim_country] ([country_key]),
  CONSTRAINT [fk_fct_visit_visit_date_key] FOREIGN KEY ([visit_date_key]) REFERENCES [gold].[dim_date] ([date_key]),
  CONSTRAINT [fk_fct_visit_planned_date_key] FOREIGN KEY ([planned_date_key]) REFERENCES [gold].[dim_date] ([date_key])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Subject visits against the schedule, with entry timeliness. Grain: One row per subject visit record.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_visit';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Visit record id (degenerate dimension).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_visit',
  @level2type = N'COLUMN', @level2name = N'visit_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Subject id (degenerate dimension).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_visit',
  @level2type = N'COLUMN', @level2name = N'subject_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Planned visit id.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_visit',
  @level2type = N'COLUMN', @level2name = N'planned_visit_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Study.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_visit',
  @level2type = N'COLUMN', @level2name = N'study_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site version in force on the visit date, or the planned date of a missed visit.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_visit',
  @level2type = N'COLUMN', @level2name = N'site_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Country of the site.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_visit',
  @level2type = N'COLUMN', @level2name = N'country_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Visit date, or null for a missed visit.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_visit',
  @level2type = N'COLUMN', @level2name = N'visit_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Planned date: enrollment plus the planned day.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_visit',
  @level2type = N'COLUMN', @level2name = N'planned_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'entered, pending-entry or missed.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_visit',
  @level2type = N'COLUMN', @level2name = N'visit_status';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Actual minus planned day.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_visit',
  @level2type = N'COLUMN', @level2name = N'day_offset';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Whether the visit fell outside its window.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_visit',
  @level2type = N'COLUMN', @level2name = N'is_out_of_window';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Days from the visit to data entry.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_visit',
  @level2type = N'COLUMN', @level2name = N'entry_lag_days';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Hour of the day, 0 to 23 in UTC, the visit''s data was entered.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_visit',
  @level2type = N'COLUMN', @level2name = N'entry_hour';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_visit',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [gold].[fct_query] (
  [query_id]          NVARCHAR(64) NOT NULL,
  [visit_id]          NVARCHAR(64) NOT NULL,
  [subject_id]        NVARCHAR(64) NOT NULL,
  [study_key]         INT NOT NULL,
  [site_key]          INT NOT NULL,
  [country_key]       INT NOT NULL,
  [opened_date_key]   INT NOT NULL,
  [answered_date_key] INT,
  [closed_date_key]   INT,
  [queried_field]     NVARCHAR(64) NOT NULL,
  [queried_form]      NVARCHAR(8) NOT NULL,
  [query_origin]      NVARCHAR(64) NOT NULL,
  [query_status]      NVARCHAR(64) NOT NULL,
  [minutes_to_answer] INT,
  [minutes_to_close]  INT,
  [is_synthetic]      BIT NOT NULL,
  CONSTRAINT [pk_fct_query] PRIMARY KEY ([query_id]),
  CONSTRAINT [fk_fct_query_study_key] FOREIGN KEY ([study_key]) REFERENCES [gold].[dim_study] ([study_key]),
  CONSTRAINT [fk_fct_query_site_key] FOREIGN KEY ([site_key]) REFERENCES [gold].[dim_site] ([site_key]),
  CONSTRAINT [fk_fct_query_country_key] FOREIGN KEY ([country_key]) REFERENCES [gold].[dim_country] ([country_key]),
  CONSTRAINT [fk_fct_query_opened_date_key] FOREIGN KEY ([opened_date_key]) REFERENCES [gold].[dim_date] ([date_key]),
  CONSTRAINT [fk_fct_query_answered_date_key] FOREIGN KEY ([answered_date_key]) REFERENCES [gold].[dim_date] ([date_key]),
  CONSTRAINT [fk_fct_query_closed_date_key] FOREIGN KEY ([closed_date_key]) REFERENCES [gold].[dim_date] ([date_key])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Data queries with their resolution times. Grain: One row per query.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_query';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Query id (degenerate dimension).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_query',
  @level2type = N'COLUMN', @level2name = N'query_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Visit record id (degenerate dimension).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_query',
  @level2type = N'COLUMN', @level2name = N'visit_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Subject id (degenerate dimension).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_query',
  @level2type = N'COLUMN', @level2name = N'subject_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Study.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_query',
  @level2type = N'COLUMN', @level2name = N'study_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site version in force when the query opened.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_query',
  @level2type = N'COLUMN', @level2name = N'site_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Country of the site.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_query',
  @level2type = N'COLUMN', @level2name = N'country_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'UTC date the query opened.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_query',
  @level2type = N'COLUMN', @level2name = N'opened_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'UTC date the site answered.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_query',
  @level2type = N'COLUMN', @level2name = N'answered_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'UTC date the query closed.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_query',
  @level2type = N'COLUMN', @level2name = N'closed_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Queried field, as DOMAIN.VARIABLE.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_query',
  @level2type = N'COLUMN', @level2name = N'queried_field';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'CRF form of the queried field: its CDASH domain, the part of queried_field before the dot.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_query',
  @level2type = N'COLUMN', @level2name = N'queried_form';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'edit-check or manual.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_query',
  @level2type = N'COLUMN', @level2name = N'query_origin';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'State at the data cut.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_query',
  @level2type = N'COLUMN', @level2name = N'query_status';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Minutes from opening to the site''s answer.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_query',
  @level2type = N'COLUMN', @level2name = N'minutes_to_answer';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Minutes from opening to closing.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_query',
  @level2type = N'COLUMN', @level2name = N'minutes_to_close';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_query',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [gold].[fct_deviation] (
  [deviation_id]        NVARCHAR(64) NOT NULL,
  [subject_id]          NVARCHAR(64) NOT NULL,
  [study_key]           INT NOT NULL,
  [site_key]            INT NOT NULL,
  [country_key]         INT NOT NULL,
  [occurred_date_key]   INT NOT NULL,
  [identified_date_key] INT NOT NULL,
  [deviation_category]  NVARCHAR(80) NOT NULL,
  [importance]          NVARCHAR(64) NOT NULL,
  [is_important]        BIT NOT NULL,
  [days_to_identify]    INT NOT NULL,
  [is_synthetic]        BIT NOT NULL,
  CONSTRAINT [pk_fct_deviation] PRIMARY KEY ([deviation_id]),
  CONSTRAINT [fk_fct_deviation_study_key] FOREIGN KEY ([study_key]) REFERENCES [gold].[dim_study] ([study_key]),
  CONSTRAINT [fk_fct_deviation_site_key] FOREIGN KEY ([site_key]) REFERENCES [gold].[dim_site] ([site_key]),
  CONSTRAINT [fk_fct_deviation_country_key] FOREIGN KEY ([country_key]) REFERENCES [gold].[dim_country] ([country_key]),
  CONSTRAINT [fk_fct_deviation_occurred_date_key] FOREIGN KEY ([occurred_date_key]) REFERENCES [gold].[dim_date] ([date_key]),
  CONSTRAINT [fk_fct_deviation_identified_date_key] FOREIGN KEY ([identified_date_key]) REFERENCES [gold].[dim_date] ([date_key])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Protocol deviations with their time to identification. Grain: One row per protocol deviation.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_deviation';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Deviation id (degenerate dimension).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_deviation',
  @level2type = N'COLUMN', @level2name = N'deviation_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Subject id (degenerate dimension).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_deviation',
  @level2type = N'COLUMN', @level2name = N'subject_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Study.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_deviation',
  @level2type = N'COLUMN', @level2name = N'study_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site version in force when the deviation occurred.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_deviation',
  @level2type = N'COLUMN', @level2name = N'site_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Country of the site.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_deviation',
  @level2type = N'COLUMN', @level2name = N'country_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the deviation occurred.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_deviation',
  @level2type = N'COLUMN', @level2name = N'occurred_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the deviation was identified.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_deviation',
  @level2type = N'COLUMN', @level2name = N'identified_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Deviation category.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_deviation',
  @level2type = N'COLUMN', @level2name = N'deviation_category';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'important or not-important.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_deviation',
  @level2type = N'COLUMN', @level2name = N'importance';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Whether the deviation is important per ICH E3.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_deviation',
  @level2type = N'COLUMN', @level2name = N'is_important';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Days from occurrence to identification.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_deviation',
  @level2type = N'COLUMN', @level2name = N'days_to_identify';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_deviation',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [gold].[fct_cec_adjudication] (
  [event_id]             NVARCHAR(64) NOT NULL,
  [subject_id]           NVARCHAR(64) NOT NULL,
  [study_key]            INT NOT NULL,
  [site_key]             INT NOT NULL,
  [country_key]          INT NOT NULL,
  [occurred_date_key]    INT NOT NULL,
  [reported_date_key]    INT NOT NULL,
  [adjudicated_date_key] INT,
  [days_to_adjudicate]   INT,
  [site_device_related]  BIT NOT NULL,
  [cec_device_related]   BIT,
  [is_synthetic]         BIT NOT NULL,
  CONSTRAINT [pk_fct_cec_adjudication] PRIMARY KEY ([event_id]),
  CONSTRAINT [fk_fct_cec_adjudication_study_key] FOREIGN KEY ([study_key]) REFERENCES [gold].[dim_study] ([study_key]),
  CONSTRAINT [fk_fct_cec_adjudication_site_key] FOREIGN KEY ([site_key]) REFERENCES [gold].[dim_site] ([site_key]),
  CONSTRAINT [fk_fct_cec_adjudication_country_key] FOREIGN KEY ([country_key]) REFERENCES [gold].[dim_country] ([country_key]),
  CONSTRAINT [fk_fct_cec_adjudication_occurred_date_key] FOREIGN KEY ([occurred_date_key]) REFERENCES [gold].[dim_date] ([date_key]),
  CONSTRAINT [fk_fct_cec_adjudication_reported_date_key] FOREIGN KEY ([reported_date_key]) REFERENCES [gold].[dim_date] ([date_key]),
  CONSTRAINT [fk_fct_cec_adjudication_adjudicated_date_key] FOREIGN KEY ([adjudicated_date_key]) REFERENCES [gold].[dim_date] ([date_key]),
  CONSTRAINT [ck_fct_cec_adjudication_reported_date_key] CHECK ([reported_date_key] IS NULL OR ([occurred_date_key] IS NOT NULL AND [occurred_date_key] <= [reported_date_key])),
  CONSTRAINT [ck_fct_cec_adjudication_adjudicated_date_key] CHECK ([adjudicated_date_key] IS NULL OR ([reported_date_key] IS NOT NULL AND [reported_date_key] <= [adjudicated_date_key]))
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Events sent to the clinical events committee, with when each was reported and adjudicated (#2881). Grain: One row per event sent for adjudication.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_cec_adjudication';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Event id (degenerate dimension).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'event_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Subject id (degenerate dimension).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'subject_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Study.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'study_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site version in force when the event was reported.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'site_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Country of the site.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'country_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the event occurred.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'occurred_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the site reported the event.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'reported_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the committee adjudicated the event, or null while it waits.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'adjudicated_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Days from the site''s report to adjudication.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'days_to_adjudicate';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Whether the site judged the event device-related.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'site_device_related';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Whether the committee judged the event device-related.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'cec_device_related';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_cec_adjudication',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [gold].[fct_monitoring_visit] (
  [monitoring_visit_id]   NVARCHAR(64) NOT NULL,
  [study_key]             INT NOT NULL,
  [site_key]              INT NOT NULL,
  [country_key]           INT NOT NULL,
  [visit_date_key]        INT NOT NULL,
  [report_final_date_key] INT,
  [monitoring_plan_key]   INT NOT NULL,
  [report_due_date_key]   INT NOT NULL,
  [visit_type]            NVARCHAR(64) NOT NULL,
  [visit_mode]            NVARCHAR(64) NOT NULL,
  [sdv_pages_due]         INT NOT NULL,
  [sdv_pages_verified]    INT NOT NULL,
  [action_items]          INT NOT NULL,
  [days_to_final_report]  INT,
  [is_synthetic]          BIT NOT NULL,
  CONSTRAINT [pk_fct_monitoring_visit] PRIMARY KEY ([monitoring_visit_id]),
  CONSTRAINT [fk_fct_monitoring_visit_study_key] FOREIGN KEY ([study_key]) REFERENCES [gold].[dim_study] ([study_key]),
  CONSTRAINT [fk_fct_monitoring_visit_site_key] FOREIGN KEY ([site_key]) REFERENCES [gold].[dim_site] ([site_key]),
  CONSTRAINT [fk_fct_monitoring_visit_country_key] FOREIGN KEY ([country_key]) REFERENCES [gold].[dim_country] ([country_key]),
  CONSTRAINT [fk_fct_monitoring_visit_visit_date_key] FOREIGN KEY ([visit_date_key]) REFERENCES [gold].[dim_date] ([date_key]),
  CONSTRAINT [fk_fct_monitoring_visit_report_final_date_key] FOREIGN KEY ([report_final_date_key]) REFERENCES [gold].[dim_date] ([date_key]),
  CONSTRAINT [fk_fct_monitoring_visit_monitoring_plan_key] FOREIGN KEY ([monitoring_plan_key]) REFERENCES [gold].[dim_monitoring_plan] ([monitoring_plan_key]),
  CONSTRAINT [fk_fct_monitoring_visit_report_due_date_key] FOREIGN KEY ([report_due_date_key]) REFERENCES [gold].[dim_date] ([date_key])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Monitoring visits with source data verification and report timeliness. Grain: One row per monitoring visit.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_monitoring_visit';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Monitoring visit id (degenerate dimension).',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'monitoring_visit_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Study.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'study_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site version in force on the visit date.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'site_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Country of the site.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'country_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Visit date.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'visit_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the report was finalised.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'report_final_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Monitoring plan in force on the visit date.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'monitoring_plan_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date the report is due: the visit date plus the plan''s report deadline.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'report_due_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'SIV, IMV or COV.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'visit_type';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'On-site or remote.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'visit_mode';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'CRF pages due for source data verification.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'sdv_pages_due';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'CRF pages source-verified.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'sdv_pages_verified';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Action items raised.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'action_items';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Days from the visit to the final report.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'days_to_final_report';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [gold].[fct_planned_monitoring_visit] (
  [planned_visit_id]    NVARCHAR(64) NOT NULL,
  [monitoring_plan_key] INT NOT NULL,
  [study_key]           INT NOT NULL,
  [site_key]            INT NOT NULL,
  [country_key]         INT NOT NULL,
  [planned_date_key]    INT NOT NULL,
  [due_date_key]        INT NOT NULL,
  [monitoring_visit_id] NVARCHAR(64),
  [actual_date_key]     INT,
  [days_late]           INT,
  [is_synthetic]        BIT NOT NULL,
  CONSTRAINT [pk_fct_planned_monitoring_visit] PRIMARY KEY ([planned_visit_id]),
  CONSTRAINT [fk_fct_planned_monitoring_visit_monitoring_plan_key] FOREIGN KEY ([monitoring_plan_key]) REFERENCES [gold].[dim_monitoring_plan] ([monitoring_plan_key]),
  CONSTRAINT [fk_fct_planned_monitoring_visit_study_key] FOREIGN KEY ([study_key]) REFERENCES [gold].[dim_study] ([study_key]),
  CONSTRAINT [fk_fct_planned_monitoring_visit_site_key] FOREIGN KEY ([site_key]) REFERENCES [gold].[dim_site] ([site_key]),
  CONSTRAINT [fk_fct_planned_monitoring_visit_country_key] FOREIGN KEY ([country_key]) REFERENCES [gold].[dim_country] ([country_key]),
  CONSTRAINT [fk_fct_planned_monitoring_visit_planned_date_key] FOREIGN KEY ([planned_date_key]) REFERENCES [gold].[dim_date] ([date_key]),
  CONSTRAINT [fk_fct_planned_monitoring_visit_due_date_key] FOREIGN KEY ([due_date_key]) REFERENCES [gold].[dim_date] ([date_key]),
  CONSTRAINT [fk_fct_planned_monitoring_visit_actual_date_key] FOREIGN KEY ([actual_date_key]) REFERENCES [gold].[dim_date] ([date_key])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Interim monitoring visits the monitoring plan schedules at each active site, each against the visit that met it. Grain: One row per planned interim monitoring visit: one per interim visit made, plus the next one due at each site still being monitored.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_planned_monitoring_visit';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Planned visit id (degenerate dimension): the site id and its sequence.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_planned_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'planned_visit_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Monitoring plan the visit is scheduled under.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_planned_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'monitoring_plan_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Study.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_planned_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'study_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site version in force on the planned date.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_planned_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'site_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Country of the site.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_planned_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'country_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Planned date: the previous monitoring visit at the site plus the plan''s interval.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_planned_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'planned_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Last on-time date: the planned date plus the plan''s visit window.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_planned_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'due_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Interim visit that met the planned visit, or null while it is outstanding.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_planned_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'monitoring_visit_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Date of the visit that met it, or null while it is outstanding.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_planned_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'actual_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Days the visit fell after its due date, 0 when on time, or null while it is outstanding.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_planned_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'days_late';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_planned_monitoring_visit',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [gold].[fct_milestone] (
  [study_key]        INT NOT NULL,
  [milestone_key]    INT NOT NULL,
  [milestone_label]  NVARCHAR(120) NOT NULL,
  [planned_date_key] INT NOT NULL,
  [actual_date_key]  INT,
  [variance_days]    INT,
  [is_reached]       BIT NOT NULL,
  [is_synthetic]     BIT NOT NULL,
  CONSTRAINT [pk_fct_milestone] PRIMARY KEY ([study_key], [milestone_key]),
  CONSTRAINT [fk_fct_milestone_study_key] FOREIGN KEY ([study_key]) REFERENCES [gold].[dim_study] ([study_key]),
  CONSTRAINT [fk_fct_milestone_milestone_key] FOREIGN KEY ([milestone_key]) REFERENCES [gold].[dim_milestone] ([milestone_key]),
  CONSTRAINT [fk_fct_milestone_planned_date_key] FOREIGN KEY ([planned_date_key]) REFERENCES [gold].[dim_date] ([date_key]),
  CONSTRAINT [fk_fct_milestone_actual_date_key] FOREIGN KEY ([actual_date_key]) REFERENCES [gold].[dim_date] ([date_key])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Study milestones, planned against actual. Grain: One row per study and milestone kind.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_milestone';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Study.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_milestone',
  @level2type = N'COLUMN', @level2name = N'study_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Milestone kind.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_milestone',
  @level2type = N'COLUMN', @level2name = N'milestone_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Label in the study''s own vocabulary.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_milestone',
  @level2type = N'COLUMN', @level2name = N'milestone_label';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Planned date.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_milestone',
  @level2type = N'COLUMN', @level2name = N'planned_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Actual date, or null when not reached.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_milestone',
  @level2type = N'COLUMN', @level2name = N'actual_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Actual minus planned date, in days.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_milestone',
  @level2type = N'COLUMN', @level2name = N'variance_days';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Whether the milestone was reached by the data cut.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_milestone',
  @level2type = N'COLUMN', @level2name = N'is_reached';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_milestone',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [gold].[fct_spend] (
  [study_key]      INT NOT NULL,
  [vendor_key]     INT NOT NULL,
  [month_date_key] INT NOT NULL,
  [budget_usd]     INT NOT NULL,
  [actual_usd]     INT NOT NULL,
  [variance_usd]   INT NOT NULL,
  [is_synthetic]   BIT NOT NULL,
  CONSTRAINT [pk_fct_spend] PRIMARY KEY ([study_key], [vendor_key], [month_date_key]),
  CONSTRAINT [fk_fct_spend_study_key] FOREIGN KEY ([study_key]) REFERENCES [gold].[dim_study] ([study_key]),
  CONSTRAINT [fk_fct_spend_vendor_key] FOREIGN KEY ([vendor_key]) REFERENCES [gold].[dim_vendor] ([vendor_key]),
  CONSTRAINT [fk_fct_spend_month_date_key] FOREIGN KEY ([month_date_key]) REFERENCES [gold].[dim_date] ([date_key])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Budget against actual spend, with each quarter spread evenly over its three months. Grain: One row per study, vendor and calendar month.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Study.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend',
  @level2type = N'COLUMN', @level2name = N'study_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Vendor; 0 for investigator grants.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend',
  @level2type = N'COLUMN', @level2name = N'vendor_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'First day of the month.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend',
  @level2type = N'COLUMN', @level2name = N'month_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Budgeted amount, whole US dollars.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend',
  @level2type = N'COLUMN', @level2name = N'budget_usd';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Actual spend, whole US dollars.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend',
  @level2type = N'COLUMN', @level2name = N'actual_usd';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Actual minus budget, whole US dollars.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend',
  @level2type = N'COLUMN', @level2name = N'variance_usd';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [gold].[fct_spend_forecast] (
  [study_key]                  INT NOT NULL,
  [vendor_key]                 INT NOT NULL,
  [as_of_date_key]             INT NOT NULL,
  [budget_to_date_usd]         INT NOT NULL,
  [actual_to_date_usd]         INT NOT NULL,
  [remaining_budget_usd]       INT NOT NULL,
  [budget_at_completion_usd]   INT NOT NULL,
  [forecast_at_completion_usd] INT NOT NULL,
  [variance_at_completion_usd] INT NOT NULL,
  [is_synthetic]               BIT NOT NULL,
  CONSTRAINT [pk_fct_spend_forecast] PRIMARY KEY ([study_key], [vendor_key]),
  CONSTRAINT [fk_fct_spend_forecast_study_key] FOREIGN KEY ([study_key]) REFERENCES [gold].[dim_study] ([study_key]),
  CONSTRAINT [fk_fct_spend_forecast_vendor_key] FOREIGN KEY ([vendor_key]) REFERENCES [gold].[dim_vendor] ([vendor_key]),
  CONSTRAINT [fk_fct_spend_forecast_as_of_date_key] FOREIGN KEY ([as_of_date_key]) REFERENCES [gold].[dim_date] ([date_key])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Budget, actual spend and forecast at completion per study and vendor at the data cut. The forecast is the actual spend to date plus the planned budget still to come, scaled by the vendor''s spend-to-budget ratio to date. Grain: One row per study and vendor at the data cut.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend_forecast';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Study.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend_forecast',
  @level2type = N'COLUMN', @level2name = N'study_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Vendor; 0 for investigator grants.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend_forecast',
  @level2type = N'COLUMN', @level2name = N'vendor_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'The data cut the forecast was made at.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend_forecast',
  @level2type = N'COLUMN', @level2name = N'as_of_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Budget for every quarter booked up to the data cut, whole US dollars.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend_forecast',
  @level2type = N'COLUMN', @level2name = N'budget_to_date_usd';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Actual spend for every quarter booked up to the data cut, whole US dollars.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend_forecast',
  @level2type = N'COLUMN', @level2name = N'actual_to_date_usd';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Planned budget for the quarters after the data cut, whole US dollars; 0 once the study''s final report is in.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend_forecast',
  @level2type = N'COLUMN', @level2name = N'remaining_budget_usd';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Budget to date plus the remaining budget, whole US dollars.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend_forecast',
  @level2type = N'COLUMN', @level2name = N'budget_at_completion_usd';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Actual spend to date plus the remaining budget times actual over budget to date, rounded to whole US dollars; the remaining budget as planned when nothing was budgeted to date.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend_forecast',
  @level2type = N'COLUMN', @level2name = N'forecast_at_completion_usd';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Forecast minus budget at completion, whole US dollars; above 0 is a forecast overrun.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend_forecast',
  @level2type = N'COLUMN', @level2name = N'variance_at_completion_usd';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_spend_forecast',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO

CREATE TABLE [gold].[fct_kri_snapshot] (
  [site_key]          INT NOT NULL,
  [snapshot_date_key] INT NOT NULL,
  [kri_id]            NVARCHAR(32) NOT NULL,
  [study_key]         INT NOT NULL,
  [country_key]       INT NOT NULL,
  [numerator]         INT NOT NULL,
  [denominator]       INT NOT NULL,
  [kri_value]         DECIMAL(12, 4),
  [is_synthetic]      BIT NOT NULL,
  CONSTRAINT [pk_fct_kri_snapshot] PRIMARY KEY ([site_key], [snapshot_date_key], [kri_id]),
  CONSTRAINT [fk_fct_kri_snapshot_site_key] FOREIGN KEY ([site_key]) REFERENCES [gold].[dim_site] ([site_key]),
  CONSTRAINT [fk_fct_kri_snapshot_snapshot_date_key] FOREIGN KEY ([snapshot_date_key]) REFERENCES [gold].[dim_date] ([date_key]),
  CONSTRAINT [fk_fct_kri_snapshot_study_key] FOREIGN KEY ([study_key]) REFERENCES [gold].[dim_study] ([study_key]),
  CONSTRAINT [fk_fct_kri_snapshot_country_key] FOREIGN KEY ([country_key]) REFERENCES [gold].[dim_country] ([country_key])
);
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Month-end key risk indicator snapshots per site, cumulative from activation to the snapshot date. Grain: One row per site, month-end snapshot date and key risk indicator.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_kri_snapshot';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Site version in force on the snapshot date.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_kri_snapshot',
  @level2type = N'COLUMN', @level2name = N'site_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Month-end snapshot date.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_kri_snapshot',
  @level2type = N'COLUMN', @level2name = N'snapshot_date_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Key risk indicator: query-rate, missed-visit-rate, important-deviation-rate or entry-lag-days.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_kri_snapshot',
  @level2type = N'COLUMN', @level2name = N'kri_id';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Study.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_kri_snapshot',
  @level2type = N'COLUMN', @level2name = N'study_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Country of the site.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_kri_snapshot',
  @level2type = N'COLUMN', @level2name = N'country_key';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Numerator, cumulative to the snapshot date.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_kri_snapshot',
  @level2type = N'COLUMN', @level2name = N'numerator';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Denominator, cumulative to the snapshot date.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_kri_snapshot',
  @level2type = N'COLUMN', @level2name = N'denominator';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Numerator over denominator, to 4 places; null when the denominator is 0.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_kri_snapshot',
  @level2type = N'COLUMN', @level2name = N'kri_value';
EXEC sys.sp_addextendedproperty
  @name = N'MS_Description', @value = N'Always true: the row describes synthetic data, nothing real.',
  @level0type = N'SCHEMA', @level0name = N'gold',
  @level1type = N'TABLE', @level1name = N'fct_kri_snapshot',
  @level2type = N'COLUMN', @level2name = N'is_synthetic';
GO
