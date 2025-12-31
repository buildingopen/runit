'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient, type Project } from '../lib/api/client';

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  useEffect(() => {
    checkAPIHealth();
    loadProjects();
  }, []);

  async function checkAPIHealth() {
    try {
      await apiClient.health();
      setApiStatus('online');
    } catch (err) {
      setApiStatus('offline');
      setError('API is offline. Make sure the control plane is running on port 3001.');
    }
  }

  async function loadProjects() {
    try {
      setLoading(true);
      const response = await apiClient.listProjects();
      setProjects(response.projects);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Execution Layer</h1>
              <p className="text-sm text-gray-500">Colab for Apps</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  apiStatus === 'online' ? 'bg-green-500' :
                  apiStatus === 'offline' ? 'bg-red-500' :
                  'bg-yellow-500'
                }`} />
                <span className="text-sm text-gray-600">
                  {apiStatus === 'online' ? 'API Online' :
                   apiStatus === 'offline' ? 'API Offline' :
                   'Checking...'}
                </span>
              </div>
              <button
                onClick={loadProjects}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Loading projects...</p>
            </div>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No projects yet</h3>
            <p className="mt-2 text-sm text-gray-500">
              Create your first project to get started with Execution Layer
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Your Projects</h2>
            {projects.map((project) => (
              <ProjectCard key={project.project_id} project={project} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const latestVersion = project.versions && project.versions.length > 0
    ? project.versions[project.versions.length - 1]
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
              Ready
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Project ID: {project.project_id}
          </p>
          <div className="mt-4 flex items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span>Version: {latestVersion?.version_hash?.substring(0, 8) || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Created: {project.created_at ? new Date(project.created_at).toLocaleDateString() : 'Unknown'}</span>
            </div>
          </div>
        </div>
        <Link
          href={`/p/${project.project_id}`}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium inline-block"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}
