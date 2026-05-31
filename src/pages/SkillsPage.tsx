import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, RefreshCw, Settings, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage, skillsApi, type Skill } from '../api'
import { formatDate } from '../utils'
import { Button, EmptyState, ErrorNotice, JsonBlock, Label, PageTitle, Panel, PanelHeader, Select, StatusPill, StickyScrollX, TextArea, TextInput } from '../components/ui'

type SkillDraft = {
  name: string
  displayName: string
  description: string
  category: 'EXTRACTOR' | 'CHECKER'
  workflowStage: 'SEMANTIC_ANALYSIS' | 'ATOMIC_ANALYSIS'
  skillContent: string
  changeLog: string
}

const initialDraft: SkillDraft = {
  name: 'semantic-rule-extractor',
  displayName: 'Semantic Rule Extractor',
  description: 'Extracts semantic rules only.',
  category: 'EXTRACTOR',
  workflowStage: 'SEMANTIC_ANALYSIS',
  skillContent: '# Skill\n\nDescribe the skill content here.',
  changeLog: 'Initial UI-created version',
}

export function SkillsPage() {
  const queryClient = useQueryClient()
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [stageFilter, setStageFilter] = useState('ALL')
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [draft, setDraft] = useState<SkillDraft>(initialDraft)

  const skillsQuery = useQuery({
    queryKey: ['skills'],
    queryFn: skillsApi.list,
  })

  const detailQuery = useQuery({
    queryKey: ['skill-detail', selectedSkillId],
    queryFn: () => skillsApi.detail(selectedSkillId || ''),
    enabled: Boolean(selectedSkillId),
  })

  const createMutation = useMutation({
    mutationFn: () => skillsApi.create(draft),
    onSuccess: (skill) => {
      toast.success('Skill version created')
      setSelectedSkillId(skill.id)
      void queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const activateMutation = useMutation({
    mutationFn: skillsApi.activate,
    onSuccess: () => {
      toast.success('Skill activated')
      void queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: skillsApi.delete,
    onSuccess: () => {
      toast.success('Skill deleted')
      setSelectedSkillId(null)
      void queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const skills = skillsQuery.data || []
  const filteredSkills = skills.filter(
    (skill) =>
      (categoryFilter === 'ALL' || skill.category === categoryFilter) &&
      (stageFilter === 'ALL' || skill.workflowStage === stageFilter),
  )
  const activeGroups = buildActiveGroups(skills)

  return (
    <div className="space-y-5">
      <PageTitle
        title="Skills"
        description="Manage semantic and atomic extractor/checker skill versions. Activation is scoped by category and workflow stage."
        actions={
          <Button onClick={() => void skillsQuery.refetch()} disabled={skillsQuery.isFetching}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {skillsQuery.error ? <ErrorNotice message={getErrorMessage(skillsQuery.error)} /> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_520px]">
        <Panel>
          <PanelHeader
            title="Skill Versions"
            description={`${filteredSkills.length} visible of ${skills.length}`}
            actions={
              <>
                <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="ALL">All categories</option>
                  <option value="EXTRACTOR">Extractor</option>
                  <option value="CHECKER">Checker</option>
                </Select>
                <Select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
                  <option value="ALL">All stages</option>
                  <option value="SEMANTIC_ANALYSIS">Semantic</option>
                  <option value="ATOMIC_ANALYSIS">Atomic</option>
                </Select>
              </>
            }
          />
          {filteredSkills.length === 0 && !skillsQuery.isLoading ? (
            <div className="p-4"><EmptyState title="No skills found" description="Create a skill version or adjust filters." /></div>
          ) : (
            <StickyScrollX>
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
                  <tr>
                    <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Skill</th>
                    <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Stage</th>
                    <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Category</th>
                    <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
                    <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Updated</th>
                    <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSkills.map((skill) => (
                    <tr key={skill.id} className="border-b border-[#edf1f6] last:border-0">
                      <td className="px-4 py-3">
                        <button className="text-left font-medium text-[#175cd3] hover:underline" onClick={() => setSelectedSkillId(skill.id)}>
                          {skill.displayName || skill.name}
                        </button>
                        <p className="text-xs text-[#667085]">{skill.name} v{skill.version}</p>
                      </td>
                      <td className="px-4 py-3 text-[#475467]">{skill.workflowStage}</td>
                      <td className="px-4 py-3 text-[#475467]">{skill.category}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <StatusPill value={skill.status} />
                          {activeGroups.get(groupKey(skill)) === skill.id ? (
                            <span className="text-xs text-[#067647]">active for stage</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#475467]">{formatDate(skill.updatedAt || skill.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => activateMutation.mutate(skill.id)} disabled={skill.status === 'ACTIVE'}>
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Activate
                          </Button>
                          <Button
                            size="icon"
                            variant="danger"
                            title="Delete skill"
                            onClick={() => {
                              if (window.confirm(`Delete ${skill.name} v${skill.version}?`)) deleteMutation.mutate(skill.id)
                            }}
                            disabled={skill.status === 'ACTIVE'}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </StickyScrollX>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader
              title="Create Skill Version"
              description="New names become active only when their category and stage have no active skill."
              actions={
                <Button variant="primary" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  Create
                </Button>
              }
            />
            <div className="grid gap-4 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Label label="Name">
                  <TextInput value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                </Label>
                <Label label="Display Name">
                  <TextInput value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} />
                </Label>
                <Label label="Category">
                  <Select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as SkillDraft['category'] })}>
                    <option value="EXTRACTOR">Extractor</option>
                    <option value="CHECKER">Checker</option>
                  </Select>
                </Label>
                <Label label="Workflow Stage">
                  <Select value={draft.workflowStage} onChange={(event) => setDraft({ ...draft, workflowStage: event.target.value as SkillDraft['workflowStage'] })}>
                    <option value="SEMANTIC_ANALYSIS">Semantic analysis</option>
                    <option value="ATOMIC_ANALYSIS">Atomic analysis</option>
                  </Select>
                </Label>
              </div>
              <Label label="Description">
                <TextInput value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
              </Label>
              <Label label="Skill Content">
                <TextArea className="min-h-[260px] font-mono text-xs" value={draft.skillContent} onChange={(event) => setDraft({ ...draft, skillContent: event.target.value })} />
              </Label>
              <Label label="Change Log">
                <TextInput value={draft.changeLog} onChange={(event) => setDraft({ ...draft, changeLog: event.target.value })} />
              </Label>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Selected Skill Detail" description={selectedSkillId || 'Select a skill'} />
            <div className="space-y-4 p-4">
              {detailQuery.data ? (
                <>
                  <div className="grid gap-2 text-sm text-[#475467]">
                    <p><span className="font-semibold text-[#344054]">Used:</span> {detailQuery.data.used ? 'yes' : 'no'}</p>
                    <p><span className="font-semibold text-[#344054]">Resources:</span> {detailQuery.data.resources.length}</p>
                  </div>
                  <JsonBlock value={detailQuery.data.skill.skillContent || ''} />
                </>
              ) : (
                <EmptyState title="No skill selected" description="Select a row to inspect content and resources." />
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function groupKey(skill: Skill) {
  return `${skill.category}:${skill.workflowStage}`
}

function buildActiveGroups(skills: Skill[]) {
  const groups = new Map<string, string>()
  for (const skill of skills) {
    if (skill.status === 'ACTIVE') groups.set(groupKey(skill), skill.id)
  }
  return groups
}
