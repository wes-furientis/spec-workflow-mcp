import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Document, Page, pdfjs } from 'react-pdf';
import { TextInputModal } from '../modals/TextInputModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { hexToColorObject, isValidHex } from './colors';

// Set up PDF.js worker and standard fonts
const PDFJS_VERSION = pdfjs.version;
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

// Standard font and cMap URLs for proper font rendering
const STANDARD_FONT_DATA_URL = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`;
const CMAP_URL = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/cmaps/`;

// Import react-pdf styles
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

export type PDFComment = {
  type: 'general' | 'selection';
  comment: string;
  timestamp: string;
  selectedText?: string;
  highlightColor?: { bg: string; border: string; name: string };
  id?: string;
  pageNumber?: number;
};

// Comment Modal component (same as ApprovalsAnnotator)
function CommentModal({
  isOpen,
  onClose,
  onSave,
  selectedText,
  highlightColor,
  initialComment = '',
  isEditing = false,
  pageNumber
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (comment: string, color: { bg: string; border: string; name: string }) => void;
  selectedText: string;
  highlightColor: { bg: string; border: string; name: string };
  initialComment?: string;
  isEditing?: boolean;
  pageNumber?: number;
}) {
  const { t } = useTranslation();
  const [comment, setComment] = useState(initialComment);
  const [selectedColorHex, setSelectedColorHex] = useState(highlightColor.name || '#FFEB3B');
  const selectedColor = useMemo(() => hexToColorObject(selectedColorHex), [selectedColorHex]);

  useEffect(() => {
    setComment(initialComment);
    setSelectedColorHex(highlightColor.name || '#FFEB3B');
  }, [initialComment, highlightColor.name, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (comment.trim()) {
      onSave(comment.trim(), selectedColor);
      setComment('');
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-t-lg sm:rounded-lg shadow-xl w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-4 lg:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-lg font-semibold text-gray-900 dark:text-white">
              {isEditing ? 'Edit Comment' : 'Add Comment'}
            </h3>
            <p className="text-sm sm:text-sm text-gray-500 dark:text-gray-400 mt-1 sm:mt-1">
              {pageNumber ? `Page ${pageNumber}` : 'Document comment'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-2 -m-2 touch-manipulation flex-shrink-0"
          >
            <svg className="w-6 h-6 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Highlighted Text Preview */}
        <div className="p-4 sm:p-4 lg:p-6 border-b border-gray-200 dark:border-gray-700 min-w-0 flex-shrink-0">
          <label className="block text-sm sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-2">
            Selected Text
          </label>
          <div
            className="p-3 sm:p-3 rounded-lg border text-sm sm:text-sm leading-relaxed max-h-32 sm:max-h-32 overflow-y-auto min-w-0"
            style={{
              backgroundColor: selectedColor.bg,
              borderColor: selectedColor.border,
              borderWidth: '2px'
            }}
          >
            <pre className="whitespace-pre-wrap font-mono text-gray-900 dark:text-gray-100 break-words overflow-x-auto max-w-full">
              {selectedText}
            </pre>
          </div>
        </div>

        {/* Color Picker */}
        <div className="p-4 sm:p-4 lg:p-6 border-b border-gray-200 dark:border-gray-700 min-w-0 flex-shrink-0">
          <label className="block text-sm sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-2">
            Highlight Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={selectedColorHex}
              onChange={(e) => {
                const v = e.target.value;
                if (isValidHex(v)) setSelectedColorHex(v.toUpperCase());
              }}
              className="w-10 h-10 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
            />
            <input
              type="text"
              value={selectedColorHex}
              onChange={(e) => {
                const v = e.target.value;
                if (isValidHex(v)) setSelectedColorHex(v.toUpperCase());
              }}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white font-mono uppercase"
              placeholder="#FFEB3B"
              maxLength={7}
            />
          </div>
        </div>

        {/* Comment Input */}
        <div className="p-4 sm:p-4 lg:p-6 min-w-0 flex-1 flex flex-col">
          <label className="block text-sm sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-2">
            Your Comment
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what changes you'd like to see..."
            className="w-full min-w-0 px-3 sm:px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-base leading-relaxed flex-1 min-h-[120px]"
            autoFocus
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 sm:mt-2 break-words">
            Press Ctrl+Enter to save
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 sm:gap-3 p-4 sm:p-4 lg:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 sm:px-4 py-3 text-base text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors touch-manipulation"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!comment.trim()}
            className="px-4 sm:px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 sm:gap-2 text-base touch-manipulation"
          >
            <svg className="w-4 h-4 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            {isEditing ? 'Update' : 'Add Comment'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PDFAnnotator({
  pdfUrl,
  comments,
  onCommentsChange,
}: {
  pdfUrl: string;
  comments: PDFComment[];
  onCommentsChange: (c: PDFComment[]) => void;
}) {
  const { t } = useTranslation();
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    selectedText: string;
    isEditing: boolean;
    editingComment?: PDFComment;
    pageNumber?: number;
  }>({ isOpen: false, selectedText: '', isEditing: false });
  const [generalCommentModalOpen, setGeneralCommentModalOpen] = useState(false);
  const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean; commentIndex: number }>({ isOpen: false, commentIndex: -1 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoize PDF options to prevent re-renders causing flashing
  const pdfOptions = useMemo(() => ({
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
  }), []);

  // Generate unique ID for new comments
  const generateCommentId = () => `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  // Handle text selection in PDF
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';

    if (!selectedText) return;

    // Open modal for adding comment
    setModalState({
      isOpen: true,
      selectedText,
      isEditing: false,
      pageNumber: pageNumber
    });

    // Clear selection after a brief delay
    setTimeout(() => {
      try { selection?.removeAllRanges(); } catch {}
    }, 50);
  }, [pageNumber]);

  function handleCommentClick(commentId: string) {
    const comment = comments.find(c => c.id === commentId);
    if (comment && comment.selectedText && comment.highlightColor) {
      setModalState({
        isOpen: true,
        selectedText: comment.selectedText,
        isEditing: true,
        editingComment: comment,
        pageNumber: comment.pageNumber
      });
    }
  }

  function handleModalSave(commentText: string, color: { bg: string; border: string; name: string }) {
    if (modalState.isEditing && modalState.editingComment) {
      // Update existing comment
      const updatedComments = comments.map(c =>
        c.id === modalState.editingComment!.id
          ? { ...c, comment: commentText, highlightColor: color, timestamp: new Date().toISOString() }
          : c
      );
      onCommentsChange(updatedComments);
    } else {
      // Add new comment
      const newComment: PDFComment = {
        type: 'selection',
        comment: commentText,
        timestamp: new Date().toISOString(),
        selectedText: modalState.selectedText,
        highlightColor: color,
        id: generateCommentId(),
        pageNumber: modalState.pageNumber
      };
      onCommentsChange([...comments, newComment]);
    }
  }

  function handleModalClose() {
    setModalState({ isOpen: false, selectedText: '', isEditing: false });
  }

  function addGeneral() {
    setGeneralCommentModalOpen(true);
  }

  function handleGeneralCommentSubmit(commentText: string) {
    onCommentsChange([...comments, {
      type: 'general',
      comment: commentText,
      timestamp: new Date().toISOString(),
      id: generateCommentId()
    }]);
  }

  function removeComment(idx: number) {
    setDeleteModalState({ isOpen: true, commentIndex: idx });
  }

  function handleDeleteConfirm() {
    const dup = comments.slice();
    dup.splice(deleteModalState.commentIndex, 1);
    onCommentsChange(dup);
  }

  // Filter comments for current page
  const pageComments = useMemo(() =>
    comments.filter(c => c.type === 'general' || c.pageNumber === pageNumber),
    [comments, pageNumber]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
      {/* PDF Viewer - Takes 2 columns on desktop */}
      <div className="lg:col-span-2">
        {/* PDF Controls */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-4 flex items-center justify-between flex-wrap gap-2">
          {/* Page Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPageNumber(p => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded disabled:opacity-50"
            >
              &larr; Prev
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Page {pageNumber} of {numPages}
            </span>
            <button
              onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded disabled:opacity-50"
            >
              Next &rarr;
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded"
            >
              -
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(s => Math.min(2, s + 0.1))}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded"
            >
              +
            </button>
          </div>
        </div>

        {/* Instruction note */}
        <div className="mb-3 p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-xs text-blue-700 dark:text-blue-300 m-0 flex items-start gap-2">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="leading-relaxed break-words">
              <strong>How to annotate:</strong> Select text in the PDF below to add a comment. Your comments will be sent back for revision.
            </span>
          </p>
        </div>

        {/* PDF Document */}
        <div
          ref={containerRef}
          className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-auto max-h-[70vh]"
          onMouseUp={handleTextSelection}
        >
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            options={pdfOptions}
            loading={
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            }
            error={
              <div className="flex items-center justify-center p-8 text-red-500">
                Failed to load PDF. Make sure the file exists.
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="mx-auto"
            />
          </Document>
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

          {/* Add comment button */}
          <button
            onClick={addGeneral}
            className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 touch-manipulation"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add General Comment
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-2 sm:space-y-3">
          {comments.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400 text-sm">
              <svg className="mx-auto w-6 h-6 sm:w-8 sm:h-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-xs sm:text-sm font-medium">No comments yet</p>
              <p className="text-xs mt-1">Select text in the PDF to add comments</p>
            </div>
          ) : (
            comments.map((c, idx) => (
              <div key={idx} className="bg-gray-50 dark:bg-gray-900 p-2 sm:p-3 rounded-lg border border-gray-200 dark:border-gray-700 relative">
                {/* Color indicator for selection comments */}
                {c.type === 'selection' && c.highlightColor && (
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                    style={{ backgroundColor: c.highlightColor.border }}
                  />
                )}

                <div className="flex items-start justify-between mb-1 sm:mb-2" style={{ marginLeft: c.type === 'selection' && c.highlightColor ? '8px' : '0' }}>
                  <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                    {/* Color dot for selection comments */}
                    {c.type === 'selection' && c.highlightColor && (
                      <div
                        className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border flex-shrink-0"
                        style={{
                          backgroundColor: c.highlightColor.bg,
                          borderColor: c.highlightColor.border
                        }}
                      />
                    )}
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 truncate">
                      {c.pageNumber && <span className="text-gray-500">p.{c.pageNumber}</span>}
                      <span className="truncate">{c.type === 'selection' ? 'Text Selection' : 'General Comment'}</span>
                    </span>
                  </div>
                  <button
                    onClick={() => removeComment(idx)}
                    className="text-gray-400 hover:text-red-500 text-xs p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors touch-manipulation flex-shrink-0 ml-2"
                    title="Delete comment"
                  >
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {c.selectedText && (
                  <div
                    className="mb-1 sm:mb-2 p-1.5 sm:p-2 rounded text-xs italic leading-relaxed cursor-pointer hover:opacity-80"
                    style={{
                      marginLeft: c.highlightColor ? '8px' : '0',
                      backgroundColor: c.highlightColor?.bg || 'rgb(254, 249, 195)',
                      borderColor: c.highlightColor?.border || '#F59E0B',
                      borderWidth: '1px'
                    }}
                    onClick={() => c.id && handleCommentClick(c.id)}
                  >
                    <span className="break-words">"{c.selectedText.substring(0, 80)}{c.selectedText.length > 80 ? '...' : ''}"</span>
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

      {/* Comment Modal */}
      {modalState.isOpen && modalState.selectedText && (
        <CommentModal
          isOpen={modalState.isOpen}
          onClose={handleModalClose}
          onSave={handleModalSave}
          selectedText={modalState.selectedText}
          highlightColor={modalState.editingComment?.highlightColor || { bg: 'rgba(255, 235, 59, 0.3)', border: '#FFEB3B', name: '#FFEB3B' }}
          initialComment={modalState.editingComment?.comment || ''}
          isEditing={modalState.isEditing}
          pageNumber={modalState.pageNumber}
        />
      )}

      {/* General Comment Modal */}
      <TextInputModal
        isOpen={generalCommentModalOpen}
        onClose={() => setGeneralCommentModalOpen(false)}
        onSubmit={handleGeneralCommentSubmit}
        title="Add General Comment"
        placeholder="Enter your feedback about the document..."
        submitText="Add Comment"
        multiline={true}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, commentIndex: -1 })}
        onConfirm={handleDeleteConfirm}
        title="Delete Comment"
        message="Are you sure you want to delete this comment?"
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
