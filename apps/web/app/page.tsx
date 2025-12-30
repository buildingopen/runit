/**
 * Landing Page
 *
 * Entry point for Execution Layer.
 */

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <h1 className="text-4xl font-semibold mb-4">
          Execution Layer
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Colab for Apps - Run FastAPI projects in ephemeral sandboxes
        </p>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Repository scaffolded. Implementation in progress.
          </p>
          <p className="text-sm text-gray-500">
            10 agents working in parallel using git worktrees.
          </p>
        </div>
      </div>
    </div>
  );
}
