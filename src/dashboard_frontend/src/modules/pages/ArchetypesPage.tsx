import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, PencilIcon, TrashIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { useProjects } from '../projects/ProjectProvider';
import { Archetype } from '../components/ArchetypeSelector';

interface CustomArchetypeDefinition {
  name: string;
  displayName: string;
  description?: string;
  extends?: string;
  steering?: {
    required?: (string | { name: string; templateFile: string; description: string })[];
    optional?: (string | { name: string; templateFile: string; description: string })[];
    custom?: { name: string; templateFile: string; description: string }[];
  };
  guidance?: {
    workflowEmphasis?: string[];
    documentationFocus?: string;
    documentationStyle?: string;
    keyConsiderations?: string[];
  };
}

type EditorMode = 'form' | 'json';

function Content() {
  const { t } = useTranslation();
  const { currentProjectId } = useProjects();

  // State for archetypes list
  const [builtInArchetypes, setBuiltInArchetypes] = useState<Archetype[]>([]);
  const [customArchetypes, setCustomArchetypes] = useState<Archetype[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('form');
  const [editingArchetype, setEditingArchetype] = useState<CustomArchetypeDefinition | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CustomArchetypeDefinition>({
    name: '',
    displayName: '',
    description: '',
    extends: '',
  });
  const [jsonText, setJsonText] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [archetypeToDelete, setArchetypeToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load archetypes
  const loadArchetypes = useCallback(async () => {
    if (!currentProjectId) return;

    try {
      setLoading(true);
      setError(null);

      // Load built-in archetypes
      const builtInResponse = await fetch('/api/archetypes');
      if (!builtInResponse.ok) {
        throw new Error('Failed to load built-in archetypes');
      }
      const builtInData = await builtInResponse.json();
      setBuiltInArchetypes(builtInData.map((a: Archetype) => ({ ...a, isCustom: false })));

      // Load custom archetypes
      const customResponse = await fetch(`/api/projects/${encodeURIComponent(currentProjectId)}/custom-archetypes`);
      if (!customResponse.ok) {
        throw new Error('Failed to load custom archetypes');
      }
      const customData = await customResponse.json();
      setCustomArchetypes(customData.archetypes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load archetypes');
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    loadArchetypes();
  }, [loadArchetypes]);

  // Handle create new
  const handleCreate = () => {
    setFormData({
      name: '',
      displayName: '',
      description: '',
      extends: '',
    });
    setJsonText(JSON.stringify({
      name: '',
      displayName: '',
      description: '',
      extends: 'generic',
    }, null, 2));
    setEditingArchetype(null);
    setIsCreating(true);
    setValidationErrors([]);
    setShowEditor(true);
  };

  // Handle edit
  const handleEdit = async (name: string) => {
    if (!currentProjectId) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/projects/${encodeURIComponent(currentProjectId)}/custom-archetypes/${encodeURIComponent(name)}`
      );

      if (!response.ok) {
        throw new Error('Failed to load archetype');
      }

      const data = await response.json();
      const archetype = data.archetype as CustomArchetypeDefinition;

      setFormData(archetype);
      setJsonText(JSON.stringify(archetype, null, 2));
      setEditingArchetype(archetype);
      setIsCreating(false);
      setValidationErrors([]);
      setShowEditor(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load archetype');
    } finally {
      setLoading(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!currentProjectId) return;

    try {
      setIsSaving(true);
      setValidationErrors([]);

      let definition: CustomArchetypeDefinition;

      if (editorMode === 'json') {
        // Validate JSON first
        const validateResponse = await fetch(
          `/api/projects/${encodeURIComponent(currentProjectId)}/custom-archetypes/validate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ json: jsonText }),
          }
        );

        const validateResult = await validateResponse.json();

        if (!validateResult.valid) {
          setValidationErrors(validateResult.errors || ['Invalid JSON']);
          return;
        }

        definition = JSON.parse(jsonText);
      } else {
        definition = formData;
      }

      // Create or update
      const url = isCreating
        ? `/api/projects/${encodeURIComponent(currentProjectId)}/custom-archetypes`
        : `/api/projects/${encodeURIComponent(currentProjectId)}/custom-archetypes/${encodeURIComponent(definition.name)}`;

      const method = isCreating ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(definition),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to save archetype');
      }

      setShowEditor(false);
      loadArchetypes();
    } catch (err) {
      setValidationErrors([err instanceof Error ? err.message : 'Failed to save archetype']);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!currentProjectId || !archetypeToDelete) return;

    try {
      setIsDeleting(true);

      const response = await fetch(
        `/api/projects/${encodeURIComponent(currentProjectId)}/custom-archetypes/${encodeURIComponent(archetypeToDelete)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to delete archetype');
      }

      setShowDeleteModal(false);
      setArchetypeToDelete(null);
      loadArchetypes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete archetype');
    } finally {
      setIsDeleting(false);
    }
  };

  // Sync form data to JSON when in form mode
  useEffect(() => {
    if (editorMode === 'form' && showEditor) {
      setJsonText(JSON.stringify(formData, null, 2));
    }
  }, [formData, editorMode, showEditor]);

  // Sync JSON to form data when switching to form mode
  const handleModeChange = (mode: EditorMode) => {
    if (mode === 'form' && editorMode === 'json') {
      try {
        const parsed = JSON.parse(jsonText);
        setFormData(parsed);
        setValidationErrors([]);
      } catch {
        setValidationErrors(['Invalid JSON - please fix before switching to form mode']);
        return;
      }
    }
    setEditorMode(mode);
  };

  if (!currentProjectId) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        {t('archetypes.noProject', 'Select a project to manage custom archetypes')}
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('archetypes.title', 'Archetypes')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('archetypes.description', 'Manage project archetypes and create custom ones')}
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          {t('archetypes.createNew', 'Create Custom Archetype')}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !showEditor && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Archetypes list */}
      {!loading && !showEditor && (
        <div className="space-y-8">
          {/* Custom Archetypes */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <DocumentDuplicateIcon className="w-5 h-5" />
              {t('archetypes.custom', 'Custom Archetypes')}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                ({customArchetypes.length})
              </span>
            </h2>

            {customArchetypes.length === 0 ? (
              <div className="p-8 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  {t('archetypes.noCustom', 'No custom archetypes yet. Create one to get started.')}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {customArchetypes.map((archetype) => (
                  <div
                    key={archetype.name}
                    className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {archetype.displayName}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {archetype.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                          {archetype.description || t('archetypes.noDescription', 'No description')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(archetype.name)}
                          className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                          title={t('archetypes.edit', 'Edit')}
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setArchetypeToDelete(archetype.name);
                            setShowDeleteModal(true);
                          }}
                          className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                          title={t('archetypes.delete', 'Delete')}
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Built-in Archetypes */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('archetypes.builtIn', 'Built-in Archetypes')}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                ({builtInArchetypes.length})
              </span>
            </h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {builtInArchetypes.map((archetype) => (
                <div
                  key={archetype.name}
                  className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {archetype.displayName}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {archetype.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                    {archetype.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {isCreating
                  ? t('archetypes.createTitle', 'Create Custom Archetype')
                  : t('archetypes.editTitle', 'Edit Custom Archetype')}
              </h2>
              <div className="flex items-center gap-4">
                {/* Mode toggle */}
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => handleModeChange('form')}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      editorMode === 'form'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {t('archetypes.formMode', 'Form')}
                  </button>
                  <button
                    onClick={() => handleModeChange('json')}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      editorMode === 'json'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {t('archetypes.jsonMode', 'JSON')}
                  </button>
                </div>
                <button
                  onClick={() => setShowEditor(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <ul className="list-disc list-inside text-red-700 dark:text-red-300 text-sm">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {editorMode === 'form' ? (
                <div className="space-y-6">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('archetypes.form.name', 'Name')} *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={!isCreating}
                      placeholder="my-archetype"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('archetypes.form.nameHelp', 'Lowercase letters, numbers, and hyphens only')}
                    </p>
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('archetypes.form.displayName', 'Display Name')} *
                    </label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      placeholder="My Custom Archetype"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('archetypes.form.description', 'Description')}
                    </label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      placeholder="Describe what this archetype is for..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Extends */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('archetypes.form.extends', 'Extends (inherit from)')}
                    </label>
                    <select
                      value={formData.extends || ''}
                      onChange={(e) => setFormData({ ...formData, extends: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="">{t('archetypes.form.noInheritance', '(No inheritance - standalone)')}</option>
                      {builtInArchetypes.map((a) => (
                        <option key={a.name} value={a.name}>
                          {a.displayName} ({a.name})
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('archetypes.form.extendsHelp', 'Inherit settings from an existing archetype')}
                    </p>
                  </div>

                  {/* Advanced hint */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {t('archetypes.form.advancedHint', 'For advanced configuration (steering docs, guidance, templates), switch to JSON mode.')}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <textarea
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    rows={20}
                    className="w-full px-3 py-2 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {t('common.save', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('archetypes.deleteConfirmTitle', 'Delete Archetype?')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('archetypes.deleteConfirmMessage', 'Are you sure you want to delete this archetype? This action cannot be undone.')}
            </p>
            <div className="flex items-center justify-end gap-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setArchetypeToDelete(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeleting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {t('common.delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ArchetypesPage() {
  return <Content />;
}
