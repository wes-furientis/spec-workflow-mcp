import React, { useEffect, useRef, useState } from 'react';
import { renderAsync, defaultOptions } from 'docx-preview';

export interface DocxComment {
  type: 'general' | 'selection';
  comment: string;
  timestamp: string;
  selectedText?: string;
  highlightColor?: { bg: string; border: string; name: string };
  id?: string;
  pageNumber?: number;
}

interface DocxViewerProps {
  docxUrl: string;
  comments: DocxComment[];
  onCommentsChange: (comments: DocxComment[]) => void;
}

// Generate unique ID for new comments
const generateCommentId = () => `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export function DocxViewer({ docxUrl, comments, onCommentsChange }: DocxViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generalCommentText, setGeneralCommentText] = useState('');
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  useEffect(() => {
    const loadDocument = async () => {
      if (!containerRef.current) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(docxUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.statusText}`);
        }

        const blob = await response.blob();

        // Clear previous content
        containerRef.current.innerHTML = '';

        // Render the DOCX using docx-preview
        await renderAsync(blob, containerRef.current, undefined, {
          ...defaultOptions,
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          experimental: true,
          trimXmlDeclaration: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });

        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load document');
        setLoading(false);
      }
    };

    loadDocument();
  }, [docxUrl]);

  // Handle text selection
  const handleMouseUp = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 0) {
      setSelectedText(text);
      setShowCommentModal(true);
    }
  };

  const addSelectionComment = () => {
    if (!commentText.trim()) return;

    const newComment: DocxComment = {
      type: 'selection',
      comment: commentText.trim(),
      timestamp: new Date().toISOString(),
      selectedText: selectedText,
      highlightColor: { bg: 'rgba(255, 235, 59, 0.3)', border: '#FFEB3B', name: '#FFEB3B' },
      id: generateCommentId(),
    };

    onCommentsChange([...comments, newComment]);
    setCommentText('');
    setSelectedText('');
    setShowCommentModal(false);
    window.getSelection()?.removeAllRanges();
  };

  const addGeneralComment = () => {
    if (!generalCommentText.trim()) return;

    const newComment: DocxComment = {
      type: 'general',
      comment: generalCommentText.trim(),
      timestamp: new Date().toISOString(),
      id: generateCommentId(),
    };

    onCommentsChange([...comments, newComment]);
    setGeneralCommentText('');
  };

  const removeComment = (index: number) => {
    const updated = comments.filter((_, i) => i !== index);
    onCommentsChange(updated);
    setDeleteConfirmIndex(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
      {/* Document Viewer - Takes 2 columns on desktop */}
      <div className="lg:col-span-2">
        {/* Instruction note */}
        <div className="mb-3 p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-xs text-blue-700 dark:text-blue-300 m-0 flex items-start gap-2">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="leading-relaxed break-words">
              <strong>How to annotate:</strong> Select text in the document below to add a comment. Your comments will be sent back for revision.
            </span>
          </p>
        </div>

        {/* Document Container */}
        <div
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-auto max-h-[70vh] p-4"
          onMouseUp={handleMouseUp}
        >
          {loading && (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading document...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center p-8 text-red-500">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <div
            ref={containerRef}
            className="docx-viewer"
            style={{ display: loading ? 'none' : 'block' }}
          />
        </div>
      </div>

      {/* Comments Sidebar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col max-h-[60vh] lg:max-h-[80vh] lg:col-span-1">
        {/* Comments Header */}
        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Comments & Feedback
          </h4>

          {/* Add general comment */}
          <div className="space-y-2">
            <textarea
              value={generalCommentText}
              onChange={(e) => setGeneralCommentText(e.target.value)}
              placeholder="Add a general comment..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 resize-none"
              rows={2}
            />
            <button
              onClick={addGeneralComment}
              disabled={!generalCommentText.trim()}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add General Comment
            </button>
          </div>
        </div>

        {/* Comments List */}
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-2 sm:space-y-3">
          {comments.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400 text-sm">
              <svg className="mx-auto w-6 h-6 sm:w-8 sm:h-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-xs sm:text-sm font-medium">No comments yet</p>
              <p className="text-xs mt-1">Select text in the document to add comments</p>
            </div>
          ) : (
            comments.map((c, idx) => (
              <div key={c.id || idx} className="bg-gray-50 dark:bg-gray-900 p-2 sm:p-3 rounded-lg border border-gray-200 dark:border-gray-700 relative">
                {/* Color indicator for selection comments */}
                {c.type === 'selection' && c.highlightColor && (
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                    style={{ backgroundColor: c.highlightColor.border }}
                  />
                )}

                <div className="flex items-start justify-between mb-1 sm:mb-2" style={{ marginLeft: c.type === 'selection' && c.highlightColor ? '8px' : '0' }}>
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    {c.type === 'selection' ? 'Text Selection' : 'General Comment'}
                  </span>
                  <button
                    onClick={() => setDeleteConfirmIndex(idx)}
                    className="text-gray-400 hover:text-red-500 text-xs p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete comment"
                  >
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {c.selectedText && (
                  <div
                    className="mb-1 sm:mb-2 p-1.5 sm:p-2 rounded text-xs italic leading-relaxed"
                    style={{
                      marginLeft: c.highlightColor ? '8px' : '0',
                      backgroundColor: c.highlightColor?.bg || 'rgb(254, 249, 195)',
                      borderColor: c.highlightColor?.border || '#F59E0B',
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}
                  >
                    <span className="break-words">"{c.selectedText.substring(0, 100)}{c.selectedText.length > 100 ? '...' : ''}"</span>
                  </div>
                )}

                <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed break-words" style={{ marginLeft: c.type === 'selection' && c.highlightColor ? '8px' : '0' }}>
                  {c.comment}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Selection Comment Modal */}
      {showCommentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Comment</h3>
            </div>

            <div className="p-4 space-y-4">
              {/* Selected text preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Selected Text
                </label>
                <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-sm">
                  <p className="italic text-gray-700 dark:text-gray-300">
                    "{selectedText.substring(0, 200)}{selectedText.length > 200 ? '...' : ''}"
                  </p>
                </div>
              </div>

              {/* Comment input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Comment
                </label>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Describe what changes you'd like to see..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 resize-none"
                  rows={4}
                  autoFocus
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCommentModal(false);
                  setCommentText('');
                  setSelectedText('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={addSelectionComment}
                disabled={!commentText.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Comment</h3>
              <p className="text-gray-600 dark:text-gray-400">Are you sure you want to delete this comment?</p>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmIndex(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => removeComment(deleteConfirmIndex)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles for docx-preview */}
      <style>{`
        .docx-viewer .docx-wrapper {
          background: white;
          padding: 20px;
        }
        .docx-viewer .docx-wrapper > section.docx {
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
        }
        .dark .docx-viewer .docx-wrapper {
          background: #1f2937;
        }
        .dark .docx-viewer .docx-wrapper > section.docx {
          background: white;
        }
      `}</style>
    </div>
  );
}
