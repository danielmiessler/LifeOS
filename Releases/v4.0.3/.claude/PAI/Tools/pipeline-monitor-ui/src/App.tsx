import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, CheckCircle2, XCircle, Clock, Zap, Play } from 'lucide-react'
import { cn } from './lib/utils'

interface StepExecution {
  id: string
  action: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime?: number
  endTime?: number
  output?: unknown
  error?: string
}

interface PipelineExecution {
  id: string
  agent: string
  pipeline: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  currentStep?: string
  steps: StepExecution[]
  startTime: number
  endTime?: number
  result?: unknown
  error?: string
}

const statusConfig = {
  pending: { icon: Clock, color: 'text-foreground-muted', bg: 'bg-background-tertiary', label: 'Pending' },
  running: { icon: Play, color: 'text-primary', bg: 'bg-primary/10', label: 'Running' },
  completed: { icon: CheckCircle2, color: 'text-status-completed', bg: 'bg-status-completed/10', label: 'Done' },
  failed: { icon: XCircle, color: 'text-status-failed', bg: 'bg-status-failed/10', label: 'Failed' },
}

function StatusBadge({ status }: { status: keyof typeof statusConfig }) {
  const config = statusConfig[status]
  const Icon = config.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', config.bg, config.color)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  )
}

function StepDot({ step, index }: { step: StepExecution; index: number }) {
  const isRunning = step.status === 'running'
  const isCompleted = step.status === 'completed'
  const isFailed = step.status === 'failed'

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'w-3 h-3 rounded-full transition-all duration-300',
        isRunning && 'bg-primary animate-pulse-glow',
        isCompleted && 'bg-status-completed',
        isFailed && 'bg-status-failed',
        !isRunning && !isCompleted && !isFailed && 'bg-border'
      )}
      title={`${step.id}: ${step.action} (${step.status})`}
    />
  )
}

function PipelineCard({ execution }: { execution: PipelineExecution }) {
  const currentStepIndex = execution.steps.findIndex(s => s.status === 'running')
  const currentStep = currentStepIndex >= 0 ? execution.steps[currentStepIndex] : null
  const completedSteps = execution.steps.filter(s => s.status === 'completed').length
  const progress = execution.steps.length > 0 ? (completedSteps / execution.steps.length) * 100 : 0
  const duration = execution.endTime
    ? ((execution.endTime - execution.startTime) / 1000).toFixed(1)
    : ((Date.now() - execution.startTime) / 1000).toFixed(1)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'rounded-xl border bg-white p-4 shadow-sm transition-all duration-300',
        execution.status === 'running' && 'border-primary/50 shadow-md shadow-primary/5',
        execution.status === 'completed' && 'border-status-completed/30',
        execution.status === 'failed' && 'border-status-failed/30'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground">{execution.pipeline}</h3>
          <p className="text-xs text-foreground-muted mt-0.5">Agent: {execution.agent}</p>
        </div>
        <StatusBadge status={execution.status} />
      </div>

      {/* Current Step */}
      {currentStep && execution.status === 'running' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-3 p-2 rounded-lg bg-primary/5 border border-primary/20"
        >
          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-foreground-secondary">
              <code className="text-primary font-mono text-xs">{currentStep.action}</code>
            </span>
          </div>
        </motion.div>
      )}

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-foreground-muted mb-1">
          <span>{completedSteps} / {execution.steps.length} steps</span>
          <span>{duration}s</span>
        </div>
        <div className="h-1.5 bg-background-tertiary rounded-full overflow-hidden">
          <motion.div
            className={cn(
              'h-full rounded-full',
              execution.status === 'completed' && 'bg-status-completed',
              execution.status === 'failed' && 'bg-status-failed',
              execution.status === 'running' && 'bg-primary',
              execution.status === 'pending' && 'bg-foreground-muted'
            )}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Step Dots */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {execution.steps.map((step, i) => (
          <StepDot key={step.id} step={step} index={i} />
        ))}
      </div>

      {/* Error Message */}
      {execution.error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 p-2 rounded-lg bg-status-failed/10 text-status-failed text-xs font-mono"
        >
          {execution.error}
        </motion.div>
      )}
    </motion.div>
  )
}

function PipelineRow({ pipelineName, executions }: { pipelineName: string; executions: PipelineExecution[] }) {
  // Get unique actions across all executions for this pipeline
  const allActions = new Set<string>()
  executions.forEach(exec => exec.steps.forEach(step => allActions.add(step.action)))
  const actionColumns = Array.from(allActions)

  // Group executions by their current action
  const getExecutionColumn = (exec: PipelineExecution): string => {
    if (exec.status === 'completed') return '__COMPLETED__'
    if (exec.status === 'failed') return '__FAILED__'
    const runningStep = exec.steps.find(s => s.status === 'running')
    if (runningStep) return runningStep.action
    const pendingStep = exec.steps.find(s => s.status === 'pending')
    if (pendingStep) return pendingStep.action
    return '__COMPLETED__'
  }

  const executionsByColumn: Record<string, PipelineExecution[]> = {}
  actionColumns.forEach(action => executionsByColumn[action] = [])
  executionsByColumn['__COMPLETED__'] = []
  executionsByColumn['__FAILED__'] = []
  executions.forEach(exec => {
    const col = getExecutionColumn(exec)
    if (!executionsByColumn[col]) executionsByColumn[col] = []
    executionsByColumn[col].push(exec)
  })

  const columns = [...actionColumns, '__COMPLETED__', '__FAILED__']

  return (
    <div className="mb-8">
      {/* Pipeline Name Header */}
      <div className="flex items-center gap-3 mb-4 px-2">
        <div className="w-3 h-3 rounded-full bg-primary" />
        <h2 className="text-lg font-semibold text-foreground">{pipelineName}</h2>
        <span className="text-sm text-foreground-muted">
          ({executions.length} execution{executions.length !== 1 ? 's' : ''})
        </span>
      </div>

      {/* Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colExecs = executionsByColumn[col] || []
          const isCompleted = col === '__COMPLETED__'
          const isFailed = col === '__FAILED__'
          const displayName = isCompleted ? 'Completed' : isFailed ? 'Failed' : col.split('/').pop()

          return (
            <div
              key={col}
              className={cn(
                'flex-shrink-0 w-72 rounded-xl border p-3',
                'bg-background-secondary',
                isCompleted && 'border-status-completed/30 bg-status-completed/5',
                isFailed && 'border-status-failed/30 bg-status-failed/5'
              )}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  {!isCompleted && !isFailed && (
                    <code className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {displayName}
                    </code>
                  )}
                  {isCompleted && (
                    <span className="text-xs font-medium text-status-completed flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {displayName}
                    </span>
                  )}
                  {isFailed && (
                    <span className="text-xs font-medium text-status-failed flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" />
                      {displayName}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium text-foreground-muted bg-background rounded-full px-2 py-0.5">
                  {colExecs.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-3 min-h-[100px]">
                <AnimatePresence mode="popLayout">
                  {colExecs.map(exec => (
                    <PipelineCard key={exec.id} execution={exec} />
                  ))}
                </AnimatePresence>
                {colExecs.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-foreground-muted text-sm">
                    No executions
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function App() {
  const [pipelines, setPipelines] = useState<Map<string, PipelineExecution>>(new Map())
  const [connected, setConnected] = useState(false)

  const handleMessage = useCallback((event: MessageEvent) => {
    const msg = JSON.parse(event.data)
    switch (msg.event) {
      case 'init':
        const newMap = new Map<string, PipelineExecution>()
        msg.data.executions.forEach((exec: PipelineExecution) => newMap.set(exec.id, exec))
        setPipelines(newMap)
        break
      case 'pipeline:start':
      case 'pipeline:update':
      case 'pipeline:complete':
      case 'pipeline:fail':
        setPipelines(prev => {
          const next = new Map(prev)
          next.set(msg.data.id, msg.data)
          return next
        })
        break
      case 'step:start':
      case 'step:complete':
      case 'step:fail':
        setPipelines(prev => {
          const next = new Map(prev)
          const exec = next.get(msg.data.executionId)
          if (exec) {
            const step = exec.steps.find(s => s.id === msg.data.stepId)
            if (step) Object.assign(step, msg.data)
            next.set(exec.id, { ...exec })
          }
          return next
        })
        break
    }
  }, [])

  useEffect(() => {
    let ws: WebSocket
    let reconnectTimeout: ReturnType<typeof setTimeout>

    const connect = () => {
      const wsUrl = `ws://${window.location.hostname}:8765/ws`
      ws = new WebSocket(wsUrl)

      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        reconnectTimeout = setTimeout(connect, 2000)
      }
      ws.onmessage = handleMessage
    }

    connect()

    return () => {
      ws?.close()
      clearTimeout(reconnectTimeout)
    }
  }, [handleMessage])

  // Group by pipeline name
  const pipelineGroups = new Map<string, PipelineExecution[]>()
  pipelines.forEach(exec => {
    const group = pipelineGroups.get(exec.pipeline) || []
    group.push(exec)
    pipelineGroups.set(exec.pipeline, group)
  })

  const totalCount = pipelines.size
  const runningCount = Array.from(pipelines.values()).filter(p => p.status === 'running').length
  const completedCount = Array.from(pipelines.values()).filter(p => p.status === 'completed').length
  const failedCount = Array.from(pipelines.values()).filter(p => p.status === 'failed').length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-3 h-3 rounded-full transition-colors',
                connected ? 'bg-status-completed animate-pulse' : 'bg-status-failed'
              )} />
              <h1 className="text-2xl font-bold text-foreground">
                PAI Pipeline Monitor
              </h1>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6">
              <StatBox icon={Activity} label="Total" value={totalCount} />
              <StatBox icon={Play} label="Running" value={runningCount} color="text-primary" />
              <StatBox icon={CheckCircle2} label="Done" value={completedCount} color="text-status-completed" />
              <StatBox icon={XCircle} label="Failed" value={failedCount} color="text-status-failed" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {pipelineGroups.size === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-foreground-muted">
            <Activity className="w-16 h-16 mb-4 opacity-30" />
            <h2 className="text-xl font-medium mb-2">Waiting for Pipelines</h2>
            <p className="text-sm">Pipeline executions will appear here in real-time</p>
          </div>
        ) : (
          Array.from(pipelineGroups.entries()).map(([name, execs]) => (
            <PipelineRow key={name} pipelineName={name} executions={execs} />
          ))
        )}
      </main>
    </div>
  )
}

function StatBox({ icon: Icon, label, value, color = 'text-foreground' }: {
  icon: typeof Activity
  label: string
  value: number
  color?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('w-4 h-4', color)} />
      <div>
        <div className={cn('text-lg font-bold', color)}>{value}</div>
        <div className="text-xs text-foreground-muted">{label}</div>
      </div>
    </div>
  )
}

export default App
