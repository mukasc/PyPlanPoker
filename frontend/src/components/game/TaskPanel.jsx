import { useState } from 'react';
import { X, Plus, Check, Trash2, Play, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';

const TaskPanel = ({ 
  tasks, 
  activeTaskId, 
  onSetActive, 
  onComplete, 
  onAdd, 
  onDelete,
  onClose, 
  isAdmin,
  fibonacci 
}) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
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

  const pendingTasks = tasks.filter(t => t.status === 'PENDING');
  const activeTasks = tasks.filter(t => t.status === 'ACTIVE');
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED');

  const TaskItem = ({ task }) => {
    const isActive = task.id === activeTaskId;
    const isCompleting = completingTaskId === task.id;
    
    return (
      <div
        className={cn(
          "p-4 rounded-lg border transition-all",
          isActive 
            ? "bg-emerald-600/10 border-emerald-500/50" 
            : task.status === 'COMPLETED'
              ? "bg-slate-800/30 border-slate-800"
              : "bg-slate-800/50 border-slate-700/50 hover:bg-slate-800"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className={cn(
              "font-medium truncate",
              task.status === 'COMPLETED' ? "text-slate-400 line-through" : "text-slate-200"
            )}>
              {task.title}
            </h4>
            {task.description && (
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
            {task.status === 'COMPLETED' && task.final_score && (
              <div className="mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700 rounded text-sm font-mono text-slate-300">
                  <Check className="w-3 h-3 text-emerald-400" />
                  {task.final_score} pts
                </span>
              </div>
            )}
          </div>
          
          {isAdmin && task.status !== 'COMPLETED' && (
            <div className="flex items-center gap-1">
              {!isActive && (
                <Button
                  data-testid={`set-active-${task.id}`}
                  size="sm"
                  variant="ghost"
                  onClick={() => onSetActive(task.id)}
                  className="text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/20"
                >
                  <Play className="w-4 h-4" />
                </Button>
              )}
              {isActive && !isCompleting && (
                <Button
                  data-testid={`start-complete-${task.id}`}
                  size="sm"
                  variant="ghost"
                  onClick={() => setCompletingTaskId(task.id)}
                  className="text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/20"
                >
                  <Check className="w-4 h-4" />
                </Button>
              )}
              <Button
                data-testid={`delete-task-${task.id}`}
                size="sm"
                variant="ghost"
                onClick={() => onDelete(task.id)}
                className="text-slate-400 hover:text-rose-400 hover:bg-rose-900/20"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Score selection for completing */}
        {isCompleting && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-sm text-slate-400 mb-3">Select final score:</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {fibonacci.map((val) => (
                <button
                  key={String(val)}
                  onClick={() => setSelectedScore(val)}
                  className={cn(
                    "w-10 h-10 rounded-lg font-mono font-bold text-sm transition-all",
                    selectedScore === val
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  )}
                >
                  {val}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCompletingTaskId(null);
                  setSelectedScore(null);
                }}
                className="text-slate-400"
              >
                Cancel
              </Button>
              <Button
                data-testid={`confirm-complete-${task.id}`}
                size="sm"
                onClick={() => handleCompleteTask(task.id)}
                disabled={selectedScore === null}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Complete Task
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-end">
      <div 
        className="h-full w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-slate-200 font-mono">Tasks</h2>
          <Button
            data-testid="close-task-panel-btn"
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Active Task */}
          {activeTasks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ChevronRight className="w-3.5 h-3.5" />
                Active
              </h3>
              <div className="space-y-2">
                {activeTasks.map(task => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {/* Pending Tasks */}
          {pendingTasks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Pending ({pendingTasks.length})
              </h3>
              <div className="space-y-2">
                {pendingTasks.map(task => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Completed ({completedTasks.length})
              </h3>
              <div className="space-y-2">
                {completedTasks.map(task => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {tasks.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500">No tasks yet</p>
              <p className="text-sm text-slate-600 mt-1">Add a task to start estimating</p>
            </div>
          )}
        </div>

        {/* Add Task Form */}
        <div className="border-t border-slate-800 p-4">
          {showAddForm ? (
            <div className="space-y-3">
              <Input
                data-testid="new-task-title-input"
                placeholder="Task title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600"
                autoFocus
              />
              <Input
                data-testid="new-task-desc-input"
                placeholder="Description (optional)"
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600"
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 text-slate-400"
                >
                  Cancel
                </Button>
                <Button
                  data-testid="add-task-submit-btn"
                  onClick={handleAddTask}
                  disabled={!newTaskTitle.trim()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Add Task
                </Button>
              </div>
            </div>
          ) : (
            <Button
              data-testid="show-add-task-btn"
              onClick={() => setShowAddForm(true)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskPanel;
