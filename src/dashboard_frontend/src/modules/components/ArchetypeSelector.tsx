import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export interface Archetype {
  name: string;
  displayName: string;
  description: string;
  isCustom?: boolean;
}

interface ArchetypeSelectorProps {
  currentArchetype: string | undefined;
  onChange: (archetype: string) => void;
  archetypes: Archetype[];
  loading?: boolean;
  disabled?: boolean;
}

export function ArchetypeSelector({
  currentArchetype,
  onChange,
  archetypes,
  loading = false,
  disabled = false,
}: ArchetypeSelectorProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build options array with "Not set" as the first option
  const options = [
    {
      name: '',
      displayName: t('archetypeSelector.notSet', 'Not set'),
      description: t('archetypeSelector.notSetDescription', 'No archetype selected'),
    },
    ...archetypes,
  ];

  // Find current selection
  const currentOption = options.find((opt) => opt.name === (currentArchetype || '')) || options[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled || loading) return;

      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (isOpen && focusedIndex >= 0) {
            const selectedOption = options[focusedIndex];
            onChange(selectedOption.name);
            setIsOpen(false);
            setFocusedIndex(-1);
            buttonRef.current?.focus();
          } else {
            setIsOpen(!isOpen);
            if (!isOpen) {
              // Set initial focus to current selection
              const currentIndex = options.findIndex((opt) => opt.name === (currentArchetype || ''));
              setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
            }
          }
          break;

        case 'Escape':
          event.preventDefault();
          setIsOpen(false);
          setFocusedIndex(-1);
          buttonRef.current?.focus();
          break;

        case 'ArrowDown':
          event.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            const currentIndex = options.findIndex((opt) => opt.name === (currentArchetype || ''));
            setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
          } else {
            setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : prev));
          }
          break;

        case 'ArrowUp':
          event.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            const currentIndex = options.findIndex((opt) => opt.name === (currentArchetype || ''));
            setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
          } else {
            setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          }
          break;

        case 'Home':
          if (isOpen) {
            event.preventDefault();
            setFocusedIndex(0);
          }
          break;

        case 'End':
          if (isOpen) {
            event.preventDefault();
            setFocusedIndex(options.length - 1);
          }
          break;

        case 'Tab':
          if (isOpen) {
            setIsOpen(false);
            setFocusedIndex(-1);
          }
          break;
      }
    },
    [isOpen, focusedIndex, options, currentArchetype, onChange, disabled, loading]
  );

  // Scroll focused option into view
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.children[focusedIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex, isOpen]);

  const handleOptionClick = (option: Archetype | { name: string; displayName: string; description: string }) => {
    onChange(option.name);
    setIsOpen(false);
    setFocusedIndex(-1);
    buttonRef.current?.focus();
  };

  const toggleDropdown = () => {
    if (disabled || loading) return;

    if (!isOpen) {
      const currentIndex = options.findIndex((opt) => opt.name === (currentArchetype || ''));
      setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
    } else {
      setFocusedIndex(-1);
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        disabled={disabled || loading}
        className={`flex items-center justify-between w-full min-w-[200px] px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white transition-colors ${
          disabled || loading
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-gray-50 dark:hover:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby="archetype-selector-label"
      >
        <span className="flex flex-col items-start truncate">
          <span className="text-sm font-medium truncate">
            {loading ? t('archetypeSelector.loading', 'Loading...') : currentOption.displayName}
          </span>
          {!loading && currentOption.name && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
              {currentOption.description}
            </span>
          )}
        </span>
        {loading ? (
          <svg
            className="w-4 h-4 ml-2 animate-spin text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <svg
            className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && !loading && (
        <div
          className="absolute left-0 mt-1 w-full min-w-[280px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-80 overflow-hidden"
          role="listbox"
          aria-activedescendant={focusedIndex >= 0 ? `archetype-option-${focusedIndex}` : undefined}
        >
          <div ref={listRef} className="overflow-y-auto max-h-72">
            {options.map((option, index) => {
              const isSelected = option.name === (currentArchetype || '');
              const isFocused = focusedIndex === index;

              return (
                <div
                  key={option.name || 'not-set'}
                  id={`archetype-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleOptionClick(option)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  className={`px-4 py-3 cursor-pointer transition-colors ${
                    isFocused
                      ? 'bg-gray-100 dark:bg-gray-700'
                      : ''
                  } ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div
                        className={`font-medium text-sm truncate ${
                          isSelected
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {option.displayName}
                      </div>
                      <div
                        className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2"
                        title={option.description}
                      >
                        {option.description}
                      </div>
                    </div>
                    {isSelected && (
                      <svg
                        className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2"
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
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer with count */}
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
            {t('archetypeSelector.count', {
              count: archetypes.length,
              defaultValue: `${archetypes.length} archetype(s) available`,
            })}
          </div>
        </div>
      )}
    </div>
  );
}
