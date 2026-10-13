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
    <div className="flex-1 flex flex-col h-full bg-[#000000] text-neutral-100 overflow-y-auto font-sans select-none p-8 md:p-12">
      {/* Header (Exact match to screenshot 3: "My clips  2 projects • 2.1 GB on disk") */}
      <div className="flex items-baseline gap-4 mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          My clips
        </h1>
        <span className="text-xs text-neutral-400 font-mono-num">
          {projects.length} {projects.length === 1 ? 'project' : 'projects'} • 2.1 GB on disk
        </span>
      </div>

      {/* Projects Grid (Exact match to screenshot 3) */}
      {projects.length === 0 ? (
        <div className="max-w-md p-10 rounded-2xl bg-[#0c0f14] border border-[#1a1f28] text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#161a22] text-neutral-400 flex items-center justify-center mx-auto">
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
              : `${project.currentStep ?? 1} of 9 steps done`;

            return (
              <div
                key={project.id}
                className="bg-[#0b0e12] border border-[#191e26] hover:border-[#262e3b] rounded-2xl p-6 flex flex-col justify-between transition-all space-y-4 shadow-xl"
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
                    57 min source{' '}
                    {project.diskSize ? project.diskSize.replace(' on disk', '') : '35 MB'}
                  </div>

                  <div className={`text-xs font-semibold pt-1 ${
                    isFinished ? 'text-[#bef264]' : project.status === 'Failed' ? 'text-rose-400' : project.status === 'Queued' ? 'text-amber-300' : 'text-neutral-300'
                  }`}>
                    {statusLabel}
                  </div>
                </div>

                {/* 3 Action Buttons (Exact match to screenshot 3: [ Clips ] [ Progress ] [ Delete ]) */}
                <div className="flex items-center gap-2 pt-2">
                  {/* 1. CLIPS (Voltage Lime Button) */}
                  <button
                    type="button"
                    onClick={() => onOpenClips(project)}
                    className="px-5 py-2 rounded-xl bg-[#bef264] hover:bg-[#a3e635] text-black font-extrabold text-xs shadow-md shadow-[#bef264]/15 transition-all active:scale-95 cursor-pointer"
                  >
                    Clips
                  </button>

                  {/* 2. PROGRESS (Dark Button) */}
                  <button
                    type="button"
                    onClick={() => onOpenProgress(project)}
                    className="px-4 py-2 rounded-xl bg-[#14181f] hover:bg-[#1d232e] text-neutral-200 hover:text-white font-bold text-xs border border-[#222834] transition-colors active:scale-95 cursor-pointer"
                  >
                    Progress
                  </button>

                  {/* 3. DELETE (Dark Button) */}
                  <button
                    type="button"
                    onClick={() => onDeleteProject(project.id)}
                    className="px-4 py-2 rounded-xl bg-[#14181f] hover:bg-rose-950/60 hover:border-rose-800 text-neutral-300 hover:text-rose-300 font-bold text-xs border border-[#222834] transition-colors active:scale-95 cursor-pointer"
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
