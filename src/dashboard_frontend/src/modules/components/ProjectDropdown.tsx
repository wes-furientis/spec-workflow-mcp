import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjects } from '../projects/ProjectProvider';

/**
 * Format an archetype name for display by capitalizing and replacing hyphens with spaces
 * e.g., "greenfield" -> "Greenfield", "web-app" -> "Web App"
 */
function formatArchetypeName(archetype: string | undefined): string {
  if (!archetype) return '';
  return archetype
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function ProjectDropdown() {
  const { t } = useTranslation();
  const { projects, currentProject, setCurrentProject, loading } = useProjects();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside or pressing ESC
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      // Focus search input when dropdown opens
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Filter projects based on search query
  const filteredProjects = projects.filter(project =>
    project.projectName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProjectSelect = (projectId: string) => {
    setCurrentProject(projectId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (isOpen) {
      setSearchQuery('');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        onClick={toggleDropdown}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-900 dark:text-gray-100"
        aria-label={t('projects.selectProject', 'Select project')}
      >
        <span className="text-sm font-medium">
          {t('projects.label', 'Projects')}:
        </span>
        <span className="text-sm font-semibold">
          {currentProject?.projectName || t('projects.none', 'No Project')}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 flex flex-col">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('projects.search', 'Search projects...')}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Project List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-6 text-sm">
                {t('projects.loading', 'Loading projects...')}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-6 text-sm">
                {searchQuery
                  ? t('projects.noResults', 'No projects found')
                  : t('projects.noProjects', 'No projects available')}
              </div>
            ) : (
              <div className="py-1">
                {filteredProjects.map((project) => {
                  const isCurrent = project.projectId === currentProject?.projectId;
                  return (
                    <button
                      key={project.projectId}
                      onClick={() => handleProjectSelect(project.projectId)}
                      className={`w-full text-left px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-between ${
                        isCurrent ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            isCurrent
                              ? 'bg-indigo-600 dark:bg-indigo-400'
                              : 'bg-gray-400 dark:bg-gray-600'
                          }`}
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-sm truncate ${
                                isCurrent
                                  ? 'font-semibold text-indigo-900 dark:text-indigo-100'
                                  : 'text-gray-900 dark:text-gray-100'
                              }`}
                              title={project.projectName}
                            >
                              {project.projectName}
                            </span>
                            {/* Archetype Badge */}
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded max-w-[80px] flex-shrink-0"
                              title={project.archetype ? formatArchetypeName(project.archetype) : t('projects.noArchetype', 'No archetype')}
                            >
                              <span className="truncate">
                                {project.archetype ? formatArchetypeName(project.archetype) : t('projects.noArchetype', 'No archetype')}
                              </span>
                            </span>
                          </div>
                          {project.instances?.length > 0 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                              {project.instances.length === 1
                                ? `PID: ${project.instances[0].pid}`
                                : `${project.instances.length} instances`}
                            </span>
                          )}
                        </div>
                      </div>
                      {isCurrent && (
                        <svg
                          className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && projects.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              {t('projects.count', {
                count: projects.length,
                defaultValue: `${projects.length} project(s)`,
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
