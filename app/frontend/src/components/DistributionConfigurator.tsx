import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'

export interface DistributionRule {
  position?: number
  range?: [number, number]
  top_percent?: number
  amount: number
  type: 'percentage' | 'fixed'
  split?: boolean
}

export interface DistributionConfig {
  type: 'percentage' | 'fixed' | 'hybrid'
  rules: DistributionRule[]
  rake: number
  rake_type: 'percentage' | 'fixed' | 'progressive'
  minimum_players?: number
  minimum_pot?: number
  refund_on_insufficient: boolean
}

interface Props {
  value: DistributionConfig
  onChange: (config: DistributionConfig) => void
  templates?: Array<{ name: string; config: DistributionConfig }>
  autoAdjustRake?: boolean  // Auto-adjust rake to make total = 100%
}

// Export validation function for parent components
export const validateDistribution = (config: DistributionConfig): boolean => {
  if (config.type !== 'percentage') return true // Only validate percentage distributions
  
  const payouts = config.rules.reduce((sum, rule) => {
    if (rule.type === 'percentage') {
      return sum + rule.amount
    }
    return sum
  }, 0)
  
  const rake = config.rake_type === 'percentage' ? config.rake : 0
  const total = payouts + rake
  
  return Math.abs(total - 100) < 0.01
}

const DEFAULT_TEMPLATES = [
  {
    name: 'Standard (40/25/15)',
    config: {
      type: 'percentage' as const,
      rules: [
        { position: 1, amount: 40, type: 'percentage' as const },
        { position: 2, amount: 25, type: 'percentage' as const },
        { position: 3, amount: 15, type: 'percentage' as const },
      ],
      rake: 5,
      rake_type: 'percentage' as const,
      minimum_players: 3,
      refund_on_insufficient: true,
    }
  },
  {
    name: 'Winner Takes All',
    config: {
      type: 'percentage' as const,
      rules: [
        { position: 1, amount: 95, type: 'percentage' as const },
      ],
      rake: 5,
      rake_type: 'percentage' as const,
      minimum_players: 2,
      refund_on_insufficient: true,
    }
  },
  {
    name: 'Top Heavy (50/30/10)',
    config: {
      type: 'percentage' as const,
      rules: [
        { position: 1, amount: 50, type: 'percentage' as const },
        { position: 2, amount: 30, type: 'percentage' as const },
        { position: 3, amount: 10, type: 'percentage' as const },
      ],
      rake: 10,
      rake_type: 'percentage' as const,
      minimum_players: 5,
      refund_on_insufficient: true,
    }
  },
  {
    name: 'Participation',
    config: {
      type: 'percentage' as const,
      rules: [
        { position: 1, amount: 30, type: 'percentage' as const },
        { position: 2, amount: 20, type: 'percentage' as const },
        { position: 3, amount: 15, type: 'percentage' as const },
        { range: [4, 999] as [number, number], amount: 30, type: 'percentage' as const, split: true },
      ],
      rake: 5,
      rake_type: 'percentage' as const,
      minimum_players: 10,
      refund_on_insufficient: true,
    }
  },
]

export function DistributionConfigurator({ value, onChange, templates = DEFAULT_TEMPLATES, autoAdjustRake = true }: Props) {
  const [newRuleType, setNewRuleType] = useState<'position' | 'range' | 'top_percent'>('position')
  
  // Auto-adjust rake when rules change
  const handleRuleChange = (rules: DistributionRule[]) => {
    if (autoAdjustRake && value.type === 'percentage' && value.rake_type === 'percentage') {
      const payoutTotal = rules.reduce((sum, rule) => {
        if (rule.type === 'percentage') {
          return sum + rule.amount
        }
        return sum
      }, 0)
      
      // Calculate what rake should be to make total = 100
      const newRake = Math.max(0, Math.min(100, 100 - payoutTotal))
      
      onChange({
        ...value,
        rules,
        rake: newRake
      })
    } else {
      onChange({ ...value, rules })
    }
  }

  const addRule = () => {
    const newRule: DistributionRule = {
      amount: 10,
      type: 'percentage',
    }

    if (newRuleType === 'position') {
      const maxPosition = Math.max(0, ...value.rules.map(r => r.position || 0))
      newRule.position = maxPosition + 1
    } else if (newRuleType === 'range') {
      const maxEnd = Math.max(3, ...value.rules.map(r => r.range?.[1] || 0))
      newRule.range = [maxEnd + 1, maxEnd + 5]
      newRule.split = true
    } else {
      newRule.top_percent = 10
    }

    handleRuleChange([...value.rules, newRule])
  }

  const updateRule = (index: number, rule: DistributionRule) => {
    const newRules = [...value.rules]
    newRules[index] = rule
    handleRuleChange(newRules)
  }

  const removeRule = (index: number) => {
    handleRuleChange(value.rules.filter((_, i) => i !== index))
  }

  const calculateTotalPayoutPercentage = () => {
    return value.rules.reduce((sum, rule) => {
      if (rule.type === 'percentage') {
        // For non-split rules or position rules, add the full amount
        // For split rules, we add the full amount as it represents total percentage for that group
        return sum + rule.amount
      }
      return sum
    }, 0)
  }
  
  const calculateTotal = () => {
    const payouts = calculateTotalPayoutPercentage()
    const rake = value.rake_type === 'percentage' ? value.rake : 0
    return payouts + rake
  }
  
  const isValidTotal = () => {
    return Math.abs(calculateTotal() - 100) < 0.01 // Allow for floating point errors
  }

  const applyTemplate = (template: typeof templates[0]) => {
    onChange(template.config)
  }

  return (
    <div className="space-y-6">
      {/* Templates */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Quick Templates</label>
        <div className="grid grid-cols-2 gap-2">
          {templates.map((template) => (
            <button
              key={template.name}
              onClick={() => applyTemplate(template)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            >
              {template.name}
            </button>
          ))}
        </div>
      </div>

      {/* Distribution Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Distribution Type</label>
        <select
          value={value.type}
          onChange={(e) => onChange({ ...value, type: e.target.value as any })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="percentage">Percentage</option>
          <option value="fixed">Fixed Amount</option>
          <option value="hybrid">Hybrid</option>
        </select>
      </div>

      {/* Total Validation Display */}
      {value.type === 'percentage' && (
        <div className={`p-3 rounded-lg ${isValidTotal() ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Total Distribution</span>
            <span className={`font-bold ${isValidTotal() ? 'text-green-600' : 'text-red-600'}`}>
              {calculateTotal().toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Payouts:</span>
              <span>{calculateTotalPayoutPercentage().toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Rake:</span>
              <span>{value.rake_type === 'percentage' ? `${value.rake}%` : 'Fixed'}</span>
            </div>
            {!isValidTotal() && (
              <div className="mt-2 text-red-600 font-medium">
                ⚠️ Total must equal 100%
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rules */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700">Payout Rules</label>
        </div>
        
        <div className="space-y-2">
          {value.rules.map((rule, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <div className="flex-1 grid grid-cols-3 gap-2">
                {/* Position/Range/Percent */}
                <div>
                  {rule.position !== undefined && (
                    <input
                      type="number"
                      value={rule.position}
                      onChange={(e) => updateRule(index, { ...rule, position: parseInt(e.target.value) })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="Position"
                      min="1"
                    />
                  )}
                  {rule.range !== undefined && (
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={rule.range[0]}
                        onChange={(e) => updateRule(index, { 
                          ...rule, 
                          range: [parseInt(e.target.value), rule.range![1]] 
                        })}
                        className="w-full px-2 py-1 border rounded text-sm"
                        placeholder="From"
                        min="1"
                      />
                      <span className="self-center">-</span>
                      <input
                        type="number"
                        value={rule.range[1]}
                        onChange={(e) => updateRule(index, { 
                          ...rule, 
                          range: [rule.range![0], parseInt(e.target.value)] 
                        })}
                        className="w-full px-2 py-1 border rounded text-sm"
                        placeholder="To"
                        min={rule.range[0]}
                      />
                    </div>
                  )}
                  {rule.top_percent !== undefined && (
                    <div className="flex items-center gap-1">
                      <span className="text-sm">Top</span>
                      <input
                        type="number"
                        value={rule.top_percent}
                        onChange={(e) => updateRule(index, { ...rule, top_percent: parseFloat(e.target.value) })}
                        className="w-16 px-2 py-1 border rounded text-sm"
                        min="1"
                        max="100"
                      />
                      <span className="text-sm">%</span>
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={rule.amount}
                    onChange={(e) => updateRule(index, { ...rule, amount: parseFloat(e.target.value) })}
                    className="w-full px-2 py-1 border rounded text-sm"
                    min="0"
                  />
                  <select
                    value={rule.type}
                    onChange={(e) => updateRule(index, { ...rule, type: e.target.value as any })}
                    className="px-2 py-1 border rounded text-sm"
                  >
                    <option value="percentage">%</option>
                    <option value="fixed">Gold</option>
                  </select>
                </div>

                {/* Split option for ranges */}
                {rule.range !== undefined && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rule.split || false}
                      onChange={(e) => updateRule(index, { ...rule, split: e.target.checked })}
                    />
                    <span className="text-sm">Split</span>
                  </label>
                )}
              </div>

              <button
                onClick={() => removeRule(index)}
                className="p-1 text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Rule */}
        <div className="flex gap-2 mt-2">
          <select
            value={newRuleType}
            onChange={(e) => setNewRuleType(e.target.value as any)}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="position">Position</option>
            <option value="range">Range</option>
            <option value="top_percent">Top %</option>
          </select>
          <button
            onClick={addRule}
            className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        </div>
      </div>

      {/* Rake Configuration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rake</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={value.rake}
              onChange={(e) => onChange({ ...value, rake: parseFloat(e.target.value) })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              min="0"
              max="100"
            />
            <select
              value={value.rake_type}
              onChange={(e) => onChange({ ...value, rake_type: e.target.value as any })}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="percentage">%</option>
              <option value="fixed">Fixed</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Min Players</label>
          <input
            type="number"
            value={value.minimum_players || ''}
            onChange={(e) => onChange({ 
              ...value, 
              minimum_players: e.target.value ? parseInt(e.target.value) : undefined 
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            min="2"
            placeholder="Optional"
          />
        </div>
      </div>

      {/* Safety Options */}
      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.refund_on_insufficient}
            onChange={(e) => onChange({ ...value, refund_on_insufficient: e.target.checked })}
          />
          <span className="text-sm">Refund all players if minimum requirements not met</span>
        </label>
      </div>

      {/* Preview */}
      {value.rules.length > 0 && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium mb-2">Payout Preview (100 Gold pot after rake)</h4>
          <div className="space-y-1 text-sm">
            {value.rules.map((rule, index) => {
              const amount = rule.type === 'percentage' ? `${rule.amount}%` : `${rule.amount} Gold`
              const payout = rule.type === 'percentage' ? (100 * rule.amount / 100).toFixed(1) : rule.amount
              
              if (rule.position !== undefined) {
                return (
                  <div key={index}>
                    Position {rule.position}: {amount} = {payout} Gold
                  </div>
                )
              } else if (rule.range !== undefined) {
                const label = rule.split ? `${amount} split` : `${amount} each`
                return (
                  <div key={index}>
                    Positions {rule.range[0]}-{rule.range[1]}: {label}
                  </div>
                )
              } else if (rule.top_percent !== undefined) {
                return (
                  <div key={index}>
                    Top {rule.top_percent}%: {amount} split
                  </div>
                )
              }
              return null
            })}
            <div className="mt-2 pt-2 border-t">
              Rake: {value.rake}{value.rake_type === 'percentage' ? '%' : ' Gold'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}