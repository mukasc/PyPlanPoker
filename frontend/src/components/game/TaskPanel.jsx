import { useState } from 'react';
import { X, Plus, Check, Trash2, Play, ChevronRight, Ban, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';

const TaskPanel = ({ 
  tasks, 
  activeTaskId, 
  onSetActive, 
  onComplete,
  onCancel, // Nova prop
  onAdd, 
  onDelete,
  onClose, 
  isAdmin,
  fibonacci 
}) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Estado para controlar qual tarefa está sendo completada
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [selectedScore, setSelectedScore] = useState(null);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    onAdd(newTaskTitle.trim(), newTaskDesc.trim());
    setNewTaskTitle('');
    setNewTaskDesc('');
    setShowAddForm(false);
  };

  const handleCompleteTask = (taskId) => {
    if (selectedScore !== null) {
      onComplete(taskId, selectedScore);
      setCompletingTaskId(null);
      setSelectedScore(null);
    }
  };

  // Agrupamento de Tasks
  const activeTasks = tasks.filter(t => t.status === 'ACTIVE');
  const pendingTasks = tasks.filter(t => t.status === 'PENDING');
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED');
  const cancelledTasks = tasks.filter(t => t.status === 'CANCELLED');

  const TaskItem = ({ task }) => {
    const isActive = task.id === activeTaskId;
    const isCompleting = completingTaskId === task.id;
    const isCancelled = task.status === 'CANCELLED';
    const isCompleted = task.status === 'COMPLETED';
    
    return (
      <div
        className={cn(
          "p-4 rounded-lg border transition-all",
          isActive 
            ? "bg-emerald-600/10 border-emerald-500/50" 
            : isCompleted
              ? "bg-slate-800/30 border-slate-800 opacity-75"
              : isCancelled
                ? "bg-slate-900/30 border-slate-800 opacity-60"
                : "bg-slate-800/50 border-slate-700/50 hover:bg-slate-800"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className={cn(
              "font-medium truncate",
              (isCompleted || isCancelled) ? "text-slate-400 line-through" : "text-slate-200"
            )}>
              {task.title}
            </h4>
            {task.description && (
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
            
            {/* Status Badges */}
            {isCompleted && task.final_score && (
              <div className="mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-900/30 text-emerald-400 border border-emerald-800 rounded text-xs font-mono">
                  <Check className="w-3 h-3" />
                  Score: {task.final_score}
                </span>
              </div>
            )}
            {isCancelled && (
              <div className="mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800 text-slate-500 border border-slate-700 rounded text-xs">
                  <Ban className="w-3 h-3" />
                  Cancelled
                </span>
              </div>
            )}
          </div>
          
          {/* Ações do Admin */}
          {isAdmin && (
            <div className="flex items-center gap-1">
              
              {/* Botão Play / Reabrir (para PENDENTE, CANCELADO ou COMPLETADO) */}
              {!isActive && !isCompleting && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onSetActive(task.id)}
                  title={isCompleted || isCancelled ? "Reopen Task" : "Start Voting"}
                  className="text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/20"
                >
                  {isCompleted || isCancelled ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
              )}

              {/* Botão Completar (Apenas se Ativa) */}
              {isActive && !isCompleting && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCompletingTaskId(task.id)}
                  title="Complete Voting"
                  className="text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/20"
                >
                  <Check className="w-4 h-4" />
                </Button>
              )}

              {/* Botão Cancelar (Se não estiver completa/cancelada) */}
              {!isCompleted && !isCancelled && !isCompleting && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onCancel(task.id)}
                  title="Cancel Task"
                  className="text-slate-400 hover:text-amber-400 hover:bg-amber-900/20"
                >
                  <Ban className="w-4 h-4" />
                </Button>
              )}

              {/* Botão Deletar (Sempre disponível) */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(task.id)}
                title="Delete Permanently"
                className="text-slate-400 hover:text-rose-400 hover:bg-rose-900/20"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Interface de Completar (Selecionar Nota Final) */}
        {isCompleting && (
          <div className="mt-4 pt-4 border-t border-slate-700 animate-in slide-in-from-top-2">
            <p className="text-sm text-slate-400 mb-3 font-semibold">Select final team score:</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {fibonacci.map((val) => (
                <button
                  key={String(val)}
                  onClick={() => setSelectedScore(String(val))}
                  className={cn(
                    "w-9 h-9 rounded shadow-sm font-mono font-bold text-sm transition-all",
                    selectedScore === String(val)
                      ? "bg-emerald-500 text-white ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-900 scale-110"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  )}
                >
                  {val}
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCompletingTaskId(null);
                  setSelectedScore(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleCompleteTask(task.id)}
                disabled={selectedScore === null}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Confirm Score
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-end">
      <div className="h-full w-full max-w-md bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-xl font-bold text-slate-200 font-mono tracking-tight">Task Backlog</h2>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* 1. Active */}
          {activeTasks.length > 0 && (
            <div className="animate-in fade-in slide-in-from-left-2">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <ChevronRight className="w-3.5 h-3.5" />
                Voting Now
              </h3>
              <div className="space-y-2">
                {activeTasks.map(task => <TaskItem key={task.id} task={task} />)}
              </div>
            </div>
          )}

          {/* 2. Pending */}
          {pendingTasks.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 pl-1">
                Up Next ({pendingTasks.length})
              </h3>
              <div className="space-y-2">
                {pendingTasks.map(task => <TaskItem key={task.id} task={task} />)}
              </div>
            </div>
          )}

          {/* 3. Completed */}
          {completedTasks.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 pl-1">
                Done ({completedTasks.length})
              </h3>
              <div className="space-y-2 opacity-90">
                {completedTasks.map(task => <TaskItem key={task.id} task={task} />)}
              </div>
            </div>
          )}

          {/* 4. Cancelled */}
          {cancelledTasks.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3 pl-1">
                Cancelled
              </h3>
              <div className="space-y-2 opacity-80">
                {cancelledTasks.map(task => <TaskItem key={task.id} task={task} />)}
              </div>
            </div>
          )}

          {tasks.length === 0 && (
            <div className="text-center py-20 flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800">
                <Plus className="w-8 h-8 text-slate-700" />
              </div>
              <p className="text-slate-400 font-medium">Your backlog is empty</p>
              <p className="text-sm text-slate-600 mt-1">Create a task to get started</p>
            </div>
          )}
        </div>

        {/* Footer: Add Form */}
        <div className="border-t border-slate-800 p-4 bg-slate-900/50">
          {showAddForm ? (
            <div className="space-y-3 bg-slate-900 p-3 rounded-lg border border-slate-800 animate-in zoom-in-95">
              <Input
                placeholder="Task title (e.g. USER-101 Login)"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="bg-slate-950 border-slate-700 text-slate-200"
                autoFocus
              />
              <Input
                placeholder="Description (optional)"
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                className="bg-slate-950 border-slate-700 text-slate-200"
              />
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setShowAddForm(false)} className="flex-1 text-slate-400">Cancel</Button>
                <Button onClick={handleAddTask} disabled={!newTaskTitle.trim()} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white">Add Task</Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setShowAddForm(true)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Task
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskPanel;