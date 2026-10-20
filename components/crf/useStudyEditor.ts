"use client";

import { useCallback, useMemo, useState } from "react";
import { logger } from "@/lib/logger";
import { clamp } from "@/lib/game-utils";
import type { ToastApi } from "@/hooks/useToast";
import {
  captureFormTemplate,
  saveFormTemplate,
} from "@/lib/crf/form-templates";
import {
  type CRFField,
  type CRFForm,
  type CRFSection,
  type CodelistDefinition,
  type EdcSimulationState,
  type EditCheckRule,
  type FieldImpactPreview,
  type SectionImpactPreview,
  type SlashCommandItem,
  type StudyBaseline,
  type StudyBranding,
  type StudyProtocol,
  type StudyReviewActor,
  type StudyVisit,
  StudyProtocolEngine,
  getPresetByIdSync,
  isDraftDirty,
  saveStudyDraft,
  saveStudySnapshot,
} from "@/lib/crf";
import {
  assignFormToVisit,
  createNextVisit,
  createSection,
  injectForm,
  resolveInsertionTarget,
  unassignFormFromVisit,
  withUniqueVariableNames,
} from "./study-edit-ops";
import type { useStudyHistory } from "./useStudyHistory";
import type { useStudioNavigation } from "./useStudioNavigation";

type ImpactPendingDeletion =
  | {
      type: "field";
      field: CRFField;
      sectionId: string;
      preview: FieldImpactPreview;
    }
  | {
      type: "section";
      section: CRFSection;
      preview: SectionImpactPreview;
    };

interface PendingStudyReplacement {
  targetStudy: StudyProtocol;
  label: string;
}

interface StudyEditorOptions {
  history: ReturnType<typeof useStudyHistory>;
  navigation: Pick<
    ReturnType<typeof useStudioNavigation>,
    | "activeFormId"
    | "setActiveFormId"
    | "activeVisitId"
    | "setActiveVisitId"
    | "selectedFieldId"
    | "setSelectedFieldId"
  >;
  /** Brings the form canvas to the front on phones after a form changes. */
  showCanvas: () => void;
  /** Closes the phone's field palette once a field has been added. */
  closeWidgetDrawer: () => void;
  playSuccess: () => void;
  toast: Pick<ToastApi, "success" | "error">;
}

/**
 * Every edit CRF Studio makes to the study: forms, visits, sections, fields,
 * review threads, branding and whole-study replacement. Each edit is one undo
 * step, and edits that would break references are held for confirmation.
 */
export function useStudyEditor({
  history,
  navigation,
  showCanvas,
  closeWidgetDrawer,
  playSuccess,
  toast,
}: StudyEditorOptions) {
  const { study, baselineStudy, commit, setStudy, replace, reset } = history;
  const {
    activeFormId,
    setActiveFormId,
    activeVisitId,
    setActiveVisitId,
    selectedFieldId,
    setSelectedFieldId,
  } = navigation;

  const [reviewAuthor, setReviewAuthor] = useState<StudyReviewActor>({
    name: "Study author",
    role: "Data Manager",
  });
  const [pendingStudyReplacement, setPendingStudyReplacement] =
    useState<PendingStudyReplacement | null>(null);
  const [impactPendingDeletion, setImpactPendingDeletion] =
    useState<ImpactPendingDeletion | null>(null);

  const activeForm: CRFForm | undefined = useMemo(
    () => study?.forms?.find((f) => f.id === activeFormId) || study?.forms?.[0],
    [study, activeFormId]
  );

  const updateSimulationState = useCallback(
    (nextSimulationState: EdcSimulationState) => {
      setStudy((prev) => {
        if (prev.simulationState === nextSimulationState) return prev;
        return {
          ...prev,
          simulationState: nextSimulationState,
        };
      });
    },
    [setStudy]
  );

  // Review threads

  const addReviewComment = useCallback(
    (fieldId: string, body: string, author: StudyReviewActor) => {
      const result = StudyProtocolEngine.addReviewComment(
        study,
        fieldId,
        body,
        author
      );
      commit(result.study);
    },
    [study, commit]
  );

  const setReviewThreadStatus = useCallback(
    (
      threadId: string,
      status: "resolved" | "open",
      author: StudyReviewActor
    ) => {
      commit(
        StudyProtocolEngine.setReviewThreadStatus(
          study,
          threadId,
          status,
          author
        )
      );
    },
    [study, commit]
  );

  const commitReviewTargetChange = useCallback(
    (fieldId: string, updates?: Partial<CRFField>) => {
      let updatedStudy = study;
      const targetForm = study.forms.find((form) =>
        StudyProtocolEngine.getField(study, form.id, fieldId)
      );
      if (updates && targetForm) {
        if (updates.variableName !== undefined) {
          const rename = StudyProtocolEngine.renameFieldEverywhere(
            study,
            targetForm.id,
            fieldId,
            updates.variableName,
            updates.label,
            reviewAuthor
          );
          if (rename.error) return;
          updatedStudy = rename.study;
        } else {
          const edit = StudyProtocolEngine.updateField(
            study,
            targetForm.id,
            fieldId,
            updates
          );
          if (edit.error) return;
          updatedStudy = StudyProtocolEngine.recordReviewTargetChange(
            edit.study,
            fieldId,
            reviewAuthor
          );
        }
      } else {
        updatedStudy = StudyProtocolEngine.recordReviewTargetChange(
          study,
          fieldId,
          reviewAuthor
        );
      }
      if (updatedStudy !== study) commit(updatedStudy);
    },
    [reviewAuthor, study, commit]
  );

  // Whole-study replacement

  const showFirstFormOf = useCallback(
    (target: StudyProtocol) => {
      setActiveFormId(target.forms[0]?.id || "");
      setActiveVisitId(target.visits[0]?.id || "");
      setSelectedFieldId(null);
    },
    [setActiveFormId, setActiveVisitId, setSelectedFieldId]
  );

  /** Loads another study, asking first when the draft has unsaved changes. */
  const requestStudyReplacement = useCallback(
    (targetStudy: StudyProtocol, label: string) => {
      if (isDraftDirty(study, baselineStudy)) {
        setPendingStudyReplacement({ targetStudy, label });
      } else {
        replace(targetStudy);
        showFirstFormOf(targetStudy);
      }
    },
    [study, baselineStudy, replace, showFirstFormOf]
  );

  const cancelStudyReplacement = useCallback(() => {
    setPendingStudyReplacement(null);
  }, []);

  /** Goes ahead with the held replacement, optionally snapshotting the draft first. */
  const confirmStudyReplacement = useCallback(
    ({ saveSnapshot }: { saveSnapshot: boolean }) => {
      if (!pendingStudyReplacement) return;
      if (saveSnapshot) {
        saveStudySnapshot(
          study,
          `Snapshot before loading ${pendingStudyReplacement.label}`
        );
        saveStudyDraft(study);
      }
      const target = pendingStudyReplacement.targetStudy;
      replace(target);
      showFirstFormOf(target);
      setPendingStudyReplacement(null);
    },
    [pendingStudyReplacement, study, replace, showFirstFormOf]
  );

  const selectPreset = useCallback(
    (presetId: string) => {
      const preset = getPresetByIdSync(presetId);
      if (preset) {
        requestStudyReplacement(
          preset,
          `Preset "${preset.studyName || presetId}"`
        );
      }
    },
    [requestStudyReplacement]
  );

  const restoreBaselineAsDraft = useCallback(
    (restoredStudy: StudyProtocol, baseline: StudyBaseline) => {
      reset(restoredStudy);
      showFirstFormOf(restoredStudy);
      playSuccess();
      toast.success(`Restored draft from baseline ${baseline.versionTag}`);
    },
    [reset, showFirstFormOf, playSuccess, toast]
  );

  /** Commits a study changed elsewhere, keeping the open form when it survives. */
  const applyStudyUpdate = useCallback(
    (updated: StudyProtocol) => {
      commit(updated);
      if (
        updated.forms[0] &&
        !updated.forms.some((f) => f.id === activeFormId)
      ) {
        setActiveFormId(updated.forms[0].id);
      }
    },
    [commit, activeFormId, setActiveFormId]
  );

  // Forms

  const addForm = useCallback(() => {
    const { study: updatedStudy, form: newForm } = StudyProtocolEngine.addForm(
      study,
      "CRF",
      `New Custom Form ${study.forms.length + 1}`
    );

    commit(updatedStudy);
    setActiveFormId(newForm.id);
    setSelectedFieldId(null);
    showCanvas();
  }, [study, commit, setActiveFormId, setSelectedFieldId, showCanvas]);

  const saveFormAsTemplate = useCallback(
    (formId: string) => {
      const form = study.forms.find((f) => f.id === formId);
      if (!form) return;
      const template = captureFormTemplate({
        form,
        codelists: study.codelists,
      });
      const result = saveFormTemplate(template);
      if (result.status === "saved") {
        toast.success(`Saved "${template.name}" as a form template`);
      } else if (result.status === "limit") {
        toast.error(
          `You can keep ${result.max} form templates. Delete one to save another.`
        );
      } else {
        toast.error("This browser could not save the template.");
      }
    },
    [study, toast]
  );

  const duplicateForm = useCallback(
    (formId: string) => {
      const { study: updatedStudy, duplicatedForm } =
        StudyProtocolEngine.duplicateForm(study, formId);
      if (!duplicatedForm) return;

      commit(updatedStudy);
      setActiveFormId(duplicatedForm.id);
      setSelectedFieldId(null);
      showCanvas();
    },
    [study, commit, setActiveFormId, setSelectedFieldId, showCanvas]
  );

  // Form variant (#675): creation and reassignment land as one history entry.
  const commitFormVariant = useCallback(
    (updatedStudy: StudyProtocol, variantFormId: string) => {
      commit(updatedStudy);
      setActiveFormId(variantFormId);
      setSelectedFieldId(null);
    },
    [commit, setActiveFormId, setSelectedFieldId]
  );

  const deleteForm = useCallback(
    (formId: string) => {
      if (study.forms.length <= 1) return;
      const { study: updatedStudy, removedForm } =
        StudyProtocolEngine.removeForm(study, formId);
      if (!removedForm) return;

      commit(updatedStudy);

      // If active form was deleted, gracefully transition to first remaining form
      if (
        activeFormId === formId ||
        !updatedStudy.forms.some((f) => f.id === activeFormId)
      ) {
        const nextActiveForm = updatedStudy.forms[0]?.id || "";
        setActiveFormId(nextActiveForm);
        setSelectedFieldId(null);
      }
    },
    [study, commit, activeFormId, setActiveFormId, setSelectedFieldId]
  );

  const injectCdashForm = useCallback(
    (
      newForm: CRFForm,
      targetVisitId?: string,
      newCodelists: CodelistDefinition[] = []
    ) => {
      commit(injectForm(study, newForm, targetVisitId, newCodelists));
      setActiveFormId(newForm.id);
      setSelectedFieldId(null);
      showCanvas();
    },
    [study, commit, setActiveFormId, setSelectedFieldId, showCanvas]
  );

  const updateFormMeta = useCallback(
    (updates: Partial<CRFForm>) => {
      if (!activeForm) return;
      const updatedForms = study.forms.map((f) =>
        f.id === activeForm.id ? { ...f, ...updates } : f
      );
      commit({ ...study, forms: updatedForms });
    },
    [activeForm, study, commit]
  );

  // Visits

  const assignFormToVisitAction = useCallback(
    (visitId: string, formId: string) => {
      commit(assignFormToVisit(study, visitId, formId));
    },
    [study, commit]
  );

  const unassignFormFromVisitAction = useCallback(
    (visitId: string, formId: string) => {
      commit(unassignFormFromVisit(study, visitId, formId));
    },
    [study, commit]
  );

  const addVisit = useCallback(() => {
    const newVisit = createNextVisit(study, Date.now());
    commit({ ...study, visits: [...study.visits, newVisit] });
    setActiveVisitId(newVisit.id);
  }, [study, commit, setActiveVisitId]);

  const deleteVisit = useCallback(
    (visitId: string) => {
      if (study.visits.length <= 1) return;
      const filtered = study.visits.filter((v) => v.id !== visitId);
      commit({ ...study, visits: filtered });
      if (activeVisitId === visitId) {
        setActiveVisitId(filtered[0]?.id || "");
      }
    },
    [study, activeVisitId, commit, setActiveVisitId]
  );

  const updateVisits = useCallback(
    (visits: StudyVisit[]) => {
      commit({ ...study, visits });
    },
    [study, commit]
  );

  // Sections

  const addSection = useCallback(() => {
    if (!activeForm) return;
    updateFormMeta({
      ...activeForm,
      sections: [...activeForm.sections, createSection(activeForm, Date.now())],
    });
  }, [activeForm, updateFormMeta]);

  const deleteSection = useCallback(
    (sectionId: string) => {
      if (!activeForm || activeForm.sections.length <= 1) return;
      const preview = StudyProtocolEngine.previewSectionRemoval(
        study,
        activeForm.id,
        sectionId
      );
      if (!preview.canSafelyDelete && preview.totalReferencesCount > 0) {
        const foundSec = activeForm.sections.find((s) => s.id === sectionId);
        if (foundSec) {
          setImpactPendingDeletion({
            type: "section",
            section: foundSec,
            preview,
          });
          return;
        }
      }
      const { study: updatedStudy } =
        StudyProtocolEngine.removeSectionWithCascade(
          study,
          activeForm.id,
          sectionId,
          undefined,
          reviewAuthor
        );
      commit(updatedStudy);
    },
    [activeForm, study, reviewAuthor, commit]
  );

  const updateSectionTitle = useCallback(
    (sectionId: string, title: string) => {
      if (!activeForm) return;
      const updatedSections = activeForm.sections.map((s) =>
        s.id === sectionId ? { ...s, title } : s
      );
      updateFormMeta({ sections: updatedSections });
    },
    [activeForm, updateFormMeta]
  );

  // Fields

  const addField = useCallback(
    (
      field: CRFField,
      options?: { sectionId?: string; targetIndex?: number }
    ) => {
      if (!activeForm) return;

      const target = resolveInsertionTarget(activeForm, selectedFieldId, {
        sectionId: options?.sectionId,
        index: options?.targetIndex,
      });
      const fieldToInsert = withUniqueVariableNames(activeForm, field);

      const { study: updatedStudy, field: insertedField } =
        StudyProtocolEngine.insertField(study, activeForm.id, fieldToInsert, {
          sectionId: target.sectionId,
          targetIndex: target.index,
        });

      if (insertedField) {
        commit(updatedStudy);
        setSelectedFieldId(insertedField.id);
      } else {
        // Fallback manual splice
        const updatedSections = activeForm.sections.map((sec) => {
          if (sec.id !== target.sectionId) return sec;
          const fields = [...sec.fields];
          const insertAt =
            target.index !== undefined
              ? clamp(target.index, 0, fields.length)
              : fields.length;
          fields.splice(insertAt, 0, fieldToInsert);
          return { ...sec, fields };
        });
        updateFormMeta({ sections: updatedSections });
        setSelectedFieldId(fieldToInsert.id);
      }
      closeWidgetDrawer();
    },
    [
      activeForm,
      selectedFieldId,
      study,
      commit,
      setSelectedFieldId,
      updateFormMeta,
      closeWidgetDrawer,
    ]
  );

  /** Runs a slash-palette or omnibar insertion at the given (or resolved) spot. */
  const insertSlashCommand = useCallback(
    (
      item: SlashCommandItem,
      slashTarget: { sectionId?: string; index?: number } = {}
    ) => {
      if (!activeForm) return;

      const target = resolveInsertionTarget(
        activeForm,
        selectedFieldId,
        slashTarget
      );

      if (item.action === "insert_smart_block" && item.smartBlockId) {
        const res = StudyProtocolEngine.insertSmartBlock(
          study,
          activeForm.id,
          item.smartBlockId,
          {
            targetSectionId: target.sectionId,
            targetIndex: target.index,
          }
        );
        if (!res.error) {
          commit(res.study);
          if (res.insertedFields.length > 0) {
            setSelectedFieldId(res.insertedFields[0].id);
          }
          playSuccess();
        }
      } else if (item.action === "insert_section") {
        addSection();
        playSuccess();
      } else if (item.action === "insert_field") {
        const res = StudyProtocolEngine.insertAtomicSlashField(
          study,
          activeForm.id,
          item.id,
          {
            targetSectionId: target.sectionId,
            targetIndex: target.index,
          }
        );
        if (!res.error && res.insertedField) {
          commit(res.study);
          setSelectedFieldId(res.insertedField.id);
          playSuccess();
        }
      }
    },
    [
      activeForm,
      selectedFieldId,
      study,
      commit,
      setSelectedFieldId,
      playSuccess,
      addSection,
    ]
  );

  const updateField = useCallback(
    (fieldId: string, updates: Partial<CRFField>) => {
      if (!activeForm) return;
      const res = StudyProtocolEngine.updateField(
        study,
        activeForm.id,
        fieldId,
        updates
      );
      if (!res.error && res.study) {
        commit(res.study);
      }
    },
    [activeForm, study, commit]
  );

  const duplicateField = useCallback(
    (sectionId: string, fieldId: string) => {
      if (!activeForm) return;
      const { study: updatedStudy, duplicatedField } =
        StudyProtocolEngine.duplicateField(
          study,
          activeForm.id,
          fieldId,
          sectionId
        );
      if (!duplicatedField) return;

      commit(updatedStudy);
      setSelectedFieldId(duplicatedField.id);
    },
    [activeForm, study, commit, setSelectedFieldId]
  );

  /** Duplicates a field of the active form, wherever its section is. */
  const duplicateFieldById = useCallback(
    (fieldId: string) => {
      const section = activeForm?.sections.find((s) =>
        s.fields.some((f) => f.id === fieldId)
      );
      if (section) duplicateField(section.id, fieldId);
    },
    [activeForm, duplicateField]
  );

  const deleteField = useCallback(
    (sectionId: string, fieldId: string) => {
      if (!activeForm) return;
      const preview = StudyProtocolEngine.previewFieldRemoval(
        study,
        activeForm.id,
        fieldId
      );
      if (!preview.canSafelyDelete && preview.references.length > 0) {
        const foundField = activeForm.sections
          .flatMap((s) => s.fields)
          .find((f) => f.id === fieldId);
        if (foundField) {
          setImpactPendingDeletion({
            type: "field",
            field: foundField,
            sectionId,
            preview,
          });
          return;
        }
      }
      const { study: updatedStudy } = StudyProtocolEngine.removeField(
        study,
        activeForm.id,
        fieldId,
        undefined,
        reviewAuthor
      );
      commit(updatedStudy);
      if (selectedFieldId === fieldId) {
        setSelectedFieldId(null);
      }
    },
    [
      activeForm,
      study,
      reviewAuthor,
      commit,
      selectedFieldId,
      setSelectedFieldId,
    ]
  );

  const cancelImpactDeletion = useCallback(() => {
    setImpactPendingDeletion(null);
  }, []);

  /** Deletes the held field or section and prunes every rule that referenced it. */
  const confirmImpactDeletion = useCallback(() => {
    if (!activeForm || !impactPendingDeletion) return;
    if (impactPendingDeletion.type === "field") {
      const { study: updatedStudy } =
        StudyProtocolEngine.removeFieldWithCascade(
          study,
          activeForm.id,
          impactPendingDeletion.field.id,
          { purgeReferencingRules: true },
          reviewAuthor
        );
      commit(updatedStudy);
      if (selectedFieldId === impactPendingDeletion.field.id) {
        setSelectedFieldId(null);
      }
    } else {
      const { study: updatedStudy } =
        StudyProtocolEngine.removeSectionWithCascade(
          study,
          activeForm.id,
          impactPendingDeletion.section.id,
          { purgeReferencingRules: true },
          reviewAuthor
        );
      commit(updatedStudy);
    }
    setImpactPendingDeletion(null);
  }, [
    activeForm,
    impactPendingDeletion,
    study,
    reviewAuthor,
    commit,
    selectedFieldId,
    setSelectedFieldId,
  ]);

  const renameFieldEverywhere = useCallback(
    (
      fieldId: string,
      newVariableName: string,
      author: StudyReviewActor = reviewAuthor
    ) => {
      if (!activeForm) return;
      const { study: updatedStudy, error } =
        StudyProtocolEngine.renameFieldEverywhere(
          study,
          activeForm.id,
          fieldId,
          newVariableName,
          undefined,
          author
        );
      if (error) {
        logger.warn("Failed to rename field everywhere:", error);
        return;
      }
      commit(updatedStudy);
    },
    [activeForm, study, reviewAuthor, commit]
  );

  const updateRules = useCallback(
    (rules: EditCheckRule[]) => {
      updateFormMeta({ rules });
    },
    [updateFormMeta]
  );

  const saveCodelist = useCallback(
    (newCodelist: CodelistDefinition) => {
      if (!study) return;
      commit({
        ...study,
        codelists: [
          ...study.codelists.filter((cl) => cl.id !== newCodelist.id),
          newCodelist,
        ],
      });
    },
    [study, commit]
  );

  const updateBranding = useCallback(
    (newBranding: StudyBranding) => {
      commit({
        ...study,
        branding: newBranding,
      });
    },
    [study, commit]
  );

  return {
    activeForm,
    reviewAuthor,
    setReviewAuthor,
    updateSimulationState,
    addReviewComment,
    setReviewThreadStatus,
    commitReviewTargetChange,
    pendingStudyReplacement,
    requestStudyReplacement,
    cancelStudyReplacement,
    confirmStudyReplacement,
    selectPreset,
    restoreBaselineAsDraft,
    applyStudyUpdate,
    addForm,
    saveFormAsTemplate,
    duplicateForm,
    commitFormVariant,
    deleteForm,
    injectCdashForm,
    updateFormMeta,
    assignFormToVisit: assignFormToVisitAction,
    unassignFormFromVisit: unassignFormFromVisitAction,
    addVisit,
    deleteVisit,
    updateVisits,
    addSection,
    deleteSection,
    updateSectionTitle,
    addField,
    insertSlashCommand,
    updateField,
    duplicateField,
    duplicateFieldById,
    deleteField,
    impactPendingDeletion,
    cancelImpactDeletion,
    confirmImpactDeletion,
    renameFieldEverywhere,
    updateRules,
    saveCodelist,
    updateBranding,
  };
}
