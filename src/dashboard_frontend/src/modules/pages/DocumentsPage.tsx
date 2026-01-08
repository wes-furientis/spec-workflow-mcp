import React, { useState, useEffect, useCallback } from 'react';
import { useApi, Approval } from '../api/api';
import { PDFAnnotator, PDFComment } from '../approvals/PDFAnnotator';
import { TextInputModal } from '../modals/TextInputModal';
import { AlertModal } from '../modals/AlertModal';
import { useTranslation } from 'react-i18next';

interface DocumentInfo {
  filename: string;
  lastModified: string;
  size: number;
  hasPdf: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function DocumentItem({
  doc,
  onConvert,
  onReview,
  converting
}: {
  doc: DocumentInfo;
  onConvert: (filename: string) => void;
  onReview: (filename: string) => void;
  converting: string | null;
}) {
  const isConverting = converting === doc.filename;

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Document Icon */}
        <div className="flex-shrink-0">
          <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-base font-medium text-gray-900 dark:text-white truncate">
            {doc.filename}
          </h3>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
            <span>{formatFileSize(doc.size)}</span>
            <span className="hidden sm:inline">•</span>
            <span>{formatDate(doc.lastModified)}</span>
            {doc.hasPdf && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  PDF Ready
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {!doc.hasPdf ? (
          <button
            onClick={() => onConvert(doc.filename)}
            disabled={isConverting}
            className="btn bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50 flex items-center gap-2"
          >
            {isConverting ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Converting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Convert to PDF
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => onReview(doc.filename)}
            className="btn bg-green-600 hover:bg-green-700 text-white text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Review PDF
          </button>
        )}
      </div>
    </div>
  );
}

function DocumentReviewModal({
  filename,
  pdfUrl,
  onClose,
  onSubmitRevision
}: {
  filename: string;
  pdfUrl: string;
  onClose: () => void;
  onSubmitRevision: (comments: PDFComment[]) => void;
}) {
  const [comments, setComments] = useState<PDFComment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmitRevision(comments);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Document Review
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{filename}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={comments.length === 0 || submitting}
              className="btn bg-orange-600 hover:bg-orange-700 text-white text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Request Revisions ({comments.length})
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* PDF Annotator */}
        <div className="flex-1 overflow-auto p-4">
          <PDFAnnotator
            pdfUrl={pdfUrl}
            comments={comments}
            onCommentsChange={setComments}
          />
        </div>
      </div>
    </div>
  );
}

export function DocumentsPage() {
  const { t } = useTranslation();
  const { listDocuments, convertDocument, getDocumentPdfUrl, createDocumentApproval, approvalsAction } = useApi();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewingDoc, setReviewingDoc] = useState<{ filename: string; pdfUrl: string } | null>(null);
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; variant: 'info' | 'success' | 'warning' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info'
  });

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listDocuments();
      setDocuments(result.documents || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [listDocuments]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleConvert = async (filename: string) => {
    setConverting(filename);
    try {
      const result = await convertDocument(filename);
      if (result.success) {
        // Reload documents to update hasPdf status
        await loadDocuments();
        setAlertModal({
          isOpen: true,
          title: 'Conversion Complete',
          message: `${filename} has been converted to PDF successfully.`,
          variant: 'success'
        });
      } else {
        throw new Error(result.message || 'Conversion failed');
      }
    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        title: 'Conversion Failed',
        message: err.message || 'Failed to convert document',
        variant: 'error'
      });
    } finally {
      setConverting(null);
    }
  };

  const handleReview = (filename: string) => {
    const pdfUrl = getDocumentPdfUrl(filename);
    setReviewingDoc({ filename, pdfUrl });
  };

  const handleSubmitRevision = async (comments: PDFComment[]) => {
    if (!reviewingDoc) return;

    try {
      // Create an approval request for this document
      const result = await createDocumentApproval(
        reviewingDoc.filename,
        `Review: ${reviewingDoc.filename}`,
        `Revision requested with ${comments.length} comments`
      );

      if (result.success && result.approvalId) {
        // Build revision summary from comments
        const general = comments.filter(c => c.type === 'general');
        const selections = comments.filter(c => c.type === 'selection');
        let summary = `Document Review Feedback (${comments.length} comments):\n\n`;

        if (general.length) {
          summary += 'General Comments:\n';
          general.forEach((c, i) => { summary += `${i + 1}. ${c.comment}\n`; });
          summary += '\n';
        }

        if (selections.length) {
          summary += 'Specific Text Comments:\n';
          selections.forEach((c, i) => {
            const text = (c.selectedText || '');
            const page = c.pageNumber ? `[Page ${c.pageNumber}] ` : '';
            summary += `${i + 1}. ${page}"${text.substring(0, 50)}${text.length > 50 ? '...' : ''}": ${c.comment}\n`;
          });
        }

        // Submit the revision request
        await approvalsAction(result.approvalId, 'needs-revision', {
          response: summary,
          annotations: JSON.stringify({
            decision: 'needs-revision',
            comments,
            summary,
            timestamp: new Date().toISOString()
          }, null, 2),
          comments
        });

        setReviewingDoc(null);
        setAlertModal({
          isOpen: true,
          title: 'Revision Requested',
          message: `Your feedback (${comments.length} comments) has been submitted. Claude will revise the document based on your comments.`,
          variant: 'success'
        });
      }
    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        title: 'Submission Failed',
        message: err.message || 'Failed to submit revision request',
        variant: 'error'
      });
    }
  };

  return (
    <div className="grid gap-4 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Document Review
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Review and annotate documents from the ./docx folder
            </p>
          </div>
          <button
            onClick={loadDocuments}
            className="btn text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8">
          <div className="flex items-center justify-center">
            <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading documents...</span>
          </div>
        </div>
      ) : documents.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8">
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">No documents found</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Place .docx files in the <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">./docx</code> folder of your project to review them here.
            </p>
          </div>
        </div>
      ) : (
        /* Document List */
        <div className="space-y-3">
          {documents.map((doc) => (
            <DocumentItem
              key={doc.filename}
              doc={doc}
              onConvert={handleConvert}
              onReview={handleReview}
              converting={converting}
            />
          ))}
        </div>
      )}

      {/* Document Review Modal */}
      {reviewingDoc && (
        <DocumentReviewModal
          filename={reviewingDoc.filename}
          pdfUrl={reviewingDoc.pdfUrl}
          onClose={() => setReviewingDoc(null)}
          onSubmitRevision={handleSubmitRevision}
        />
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        variant={alertModal.variant}
      />
    </div>
  );
}
