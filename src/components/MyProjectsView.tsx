import React from 'react';
import { ProjectItem } from '../types/clipper';
import { Plus, Film } from 'lucide-react';

interface MyProjectsViewProps {
  projects: ProjectItem[];
  onOpenClips: (project: ProjectItem) => void;
  onOpenProgress: (project: ProjectItem) => void;
  onDeleteProject: (projectId: string) => void;
  onNewProject: () => void;
}

export const MyProjectsView: React.FC<MyProjectsViewProps> = ({
  projects,
  onOpenClips,
  onOpenProgress,
  onDeleteProject,
  onNewProject
}) => {
  return (
    <div className="flex-1 flex flex-col h-full bg-[#050b08] text-neutral-100 overflow-y-auto font-sans select-none p-8 md:p-12">
      {/* Header (Exact match to screenshot 3: "My clips  2 projects") */}
      <div className="flex items-baseline gap-4 mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          My clips
        </h1>
        <span className="text-xs text-neutral-400 font-mono-num">
          {projects.length} {projects.length === 1 ? 'project' : 'projects'}
        </span>
      </div>

      {/* Projects Grid (Exact match to screenshot 3) */}
      {projects.length === 0 ? (
        <div className="max-w-md p-10 rounded-2xl bg-[#0a130f] border border-[#16271f] text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#13211a] text-neutral-400 flex items-center justify-center mx-auto">
            <Film className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">No projects yet</h3>
          <p className="text-xs text-neutral-400">
            Start by uploading a video or pasting a link to extract viral clips.
          </p>
          <button
            onClick={onNewProject}
            className="px-4 py-2 rounded-xl bg-[#bef264] text-black font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
          {projects.map((project) => {
            const isFinished = project.status === 'Finished';
            const statusLabel = isFinished
              ? 'Finished'
              : project.status === 'Queued'
              ? 'Queued: waiting for the current project to finish'
              : project.status === 'Failed'
              ? 'Failed: open Progress to see why'
              : `${project.stepsDone ?? 0} of ${project.stepsTotal ?? 9} steps done`;

            return (
              <div
                key={project.id}
                className="bg-[#09110e] border border-[#15251e] hover:border-[#23362d] rounded-2xl p-6 flex flex-col justify-between transition-all space-y-4 shadow-xl"
              >
                {/* Title & Metadata */}
                <div className="space-y-1.5">
                  <h2 
                    className="text-base font-bold text-white tracking-tight leading-snug break-all line-clamp-2"
                    title={project.name}
                  >
                    {project.name.endsWith('.mp4') ? project.name : `${project.name}.mp4`}
                  </h2>

                  <div className="text-xs text-neutral-400 font-mono-num">
                    {project.createdAt.toLowerCase().includes('today') || project.createdAt.toLowerCase().includes('yesterday')
                      ? project.createdAt 
                      : 'today'}{' '}
                    {project.sourceDuration ? `${Math.max(1, Math.round(project.sourceDuration / 60))} min source` : ''}{' '}
                    {project.diskSize ? project.diskSize.replace(' on disk', '') : ''}
                  </div>

                  <div className={`text-xs font-semibold pt-1 ${
                    isFinished ? 'text-[#8fd0a4]' : project.status === 'Failed' ? 'text-rose-400' : project.status === 'Queued' ? 'text-amber-300' : 'text-neutral-300'
                  }`}>
                    {statusLabel}
                  </div>
                </div>

                {/* 3 Action Buttons (Exact match to screenshot 3: [ Clips ] [ Progress ] [ Delete ]) */}
                <div className="flex items-center gap-2 pt-2">
                  {/* 1. CLIPS (Voltage Lime Button) */}
                  <button
                    type="button"
                    onClick={() => isFinished && onOpenClips(project)}
                    disabled={!isFinished}
                    title={isFinished ? '' : 'Clips open when processing is finished'}
                    className={`px-5 py-2 rounded-xl font-extrabold text-xs transition-all ${isFinished ? 'bg-[#bef264] hover:bg-[#a3e635] text-black shadow-md shadow-[#3f9a5a]/15 active:scale-95 cursor-pointer' : 'bg-[#1a2a22] text-neutral-500 cursor-not-allowed opacity-60'}`}
                  >
                    Clips
                  </button>

                  {/* 2. PROGRESS (Dark Button) */}
                  <button
                    type="button"
                    onClick={() => onOpenProgress(project)}
                    className="px-4 py-2 rounded-xl bg-[#111e18] hover:bg-[#192c23] text-neutral-200 hover:text-white font-bold text-xs border border-[#1d3228] transition-colors active:scale-95 cursor-pointer"
                  >
                    Progress
                  </button>

                  {/* 3. DELETE (Dark Button) */}
                  <button
                    type="button"
                    onClick={() => onDeleteProject(project.id)}
                    className="px-4 py-2 rounded-xl bg-[#111e18] hover:bg-rose-950/60 hover:border-rose-800 text-neutral-300 hover:text-rose-300 font-bold text-xs border border-[#1d3228] transition-colors active:scale-95 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
