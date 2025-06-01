import { useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowsUpDownIcon, InformationCircleIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

export type PaymentCategory = 'fees' | 'penalties' | 'interest' | 'principal' | 'escrow';

export interface WaterfallStep {
  id: string;
  category: PaymentCategory;
  percentage: number;
}

interface WaterfallBuilderProps {
  value: WaterfallStep[];
  onChange: (steps: WaterfallStep[]) => void;
  disabled?: boolean;
}

const CATEGORY_LABELS: Record<PaymentCategory, string> = {
  fees: 'Fees',
  penalties: 'Penalties',
  interest: 'Interest',
  principal: 'Principal',
  escrow: 'Escrow',
};

const CATEGORY_DESCRIPTIONS: Record<PaymentCategory, string> = {
  fees: 'Late fees, origination fees, and other charges',
  penalties: 'Penalty charges and NSF fees',
  interest: 'Accrued interest on the loan',
  principal: 'Original loan amount',
  escrow: 'Property taxes, insurance, and other escrow items',
};

const PREDEFINED_WATERFALLS = [
  {
    name: 'Standard',
    description: 'Fees → Penalties → Interest → Principal → Escrow',
    steps: [
      { id: '1', category: 'fees' as PaymentCategory, percentage: 100 },
      { id: '2', category: 'penalties' as PaymentCategory, percentage: 100 },
      { id: '3', category: 'interest' as PaymentCategory, percentage: 100 },
      { id: '4', category: 'principal' as PaymentCategory, percentage: 100 },
      { id: '5', category: 'escrow' as PaymentCategory, percentage: 100 },
    ],
  },
  {
    name: 'Interest First',
    description: 'Interest → Fees → Penalties → Principal → Escrow',
    steps: [
      { id: '1', category: 'interest' as PaymentCategory, percentage: 100 },
      { id: '2', category: 'fees' as PaymentCategory, percentage: 100 },
      { id: '3', category: 'penalties' as PaymentCategory, percentage: 100 },
      { id: '4', category: 'principal' as PaymentCategory, percentage: 100 },
      { id: '5', category: 'escrow' as PaymentCategory, percentage: 100 },
    ],
  },
  {
    name: 'Principal First',
    description: 'Principal → Interest → Fees → Penalties → Escrow',
    steps: [
      { id: '1', category: 'principal' as PaymentCategory, percentage: 100 },
      { id: '2', category: 'interest' as PaymentCategory, percentage: 100 },
      { id: '3', category: 'fees' as PaymentCategory, percentage: 100 },
      { id: '4', category: 'penalties' as PaymentCategory, percentage: 100 },
      { id: '5', category: 'escrow' as PaymentCategory, percentage: 100 },
    ],
  },
];

function SortableItem({ step, onUpdate, onRemove, disabled }: {
  step: WaterfallStep;
  onUpdate: (id: string, updates: Partial<WaterfallStep>) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-lg p-4 ${isDragging ? 'shadow-lg' : 'shadow-sm'}`}
    >
      <div className="flex items-center space-x-4">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={disabled}
          className="text-gray-400 hover:text-gray-600 cursor-move"
        >
          <ArrowsUpDownIcon className="h-5 w-5" />
        </button>
        
        <div className="flex-1">
          <select
            value={step.category}
            onChange={(e) => onUpdate(step.id, { category: e.target.value as PaymentCategory })}
            disabled={disabled}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {CATEGORY_DESCRIPTIONS[step.category]}
          </p>
        </div>
        
        <div className="w-32">
          <div className="relative rounded-md shadow-sm">
            <input
              type="number"
              min="0"
              max="100"
              value={step.percentage}
              onChange={(e) => onUpdate(step.id, { percentage: Number(e.target.value) })}
              disabled={disabled}
              className="focus:ring-primary-500 focus:border-primary-500 block w-full pr-10 sm:text-sm border-gray-300 rounded-md"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">%</span>
            </div>
          </div>
        </div>
        
        <button
          type="button"
          onClick={() => onRemove(step.id)}
          disabled={disabled}
          className="text-red-400 hover:text-red-600"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export const PaymentWaterfallBuilder: React.FC<WaterfallBuilderProps> = ({
  value = [],
  onChange,
  disabled = false,
}) => {
  const [showInfo, setShowInfo] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = value.findIndex((step) => step.id === active.id);
      const newIndex = value.findIndex((step) => step.id === over.id);
      onChange(arrayMove(value, oldIndex, newIndex));
    }
  };

  const handleAdd = () => {
    const newStep: WaterfallStep = {
      id: Date.now().toString(),
      category: 'interest',
      percentage: 100,
    };
    onChange([...value, newStep]);
  };

  const handleUpdate = (id: string, updates: Partial<WaterfallStep>) => {
    onChange(
      value.map((step) =>
        step.id === id ? { ...step, ...updates } : step
      )
    );
  };

  const handleRemove = (id: string) => {
    onChange(value.filter((step) => step.id !== id));
  };

  const handleLoadTemplate = (template: typeof PREDEFINED_WATERFALLS[0]) => {
    onChange(template.steps.map(step => ({ ...step, id: Date.now().toString() + Math.random() })));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Payment Waterfall Configuration</h3>
        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          className="text-gray-400 hover:text-gray-600"
        >
          <InformationCircleIcon className="h-5 w-5" />
        </button>
      </div>

      {showInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">How Payment Waterfalls Work</h4>
          <p className="text-sm text-blue-700">
            Payment waterfalls determine how incoming payments are allocated across different loan components.
            Payments flow through each step in order, with the specified percentage being the maximum allocation
            for that category. Any remaining payment flows to the next step.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Load Template</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PREDEFINED_WATERFALLS.map((template) => (
            <button
              key={template.name}
              type="button"
              onClick={() => handleLoadTemplate(template)}
              disabled={disabled}
              className="inline-flex flex-col items-start px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <span className="font-medium">{template.name}</span>
              <span className="text-xs text-gray-500">{template.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={value.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {value.map((step) => (
              <SortableItem
                key={step.id}
                step={step}
                onUpdate={handleUpdate}
                onRemove={handleRemove}
                disabled={disabled}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
      >
        <PlusIcon className="h-5 w-5 mr-2" />
        Add Step
      </button>

      {value.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Preview</h4>
          <p className="text-sm text-gray-600">
            Payment flow: {value.map((step, idx) => (
              <span key={step.id}>
                {CATEGORY_LABELS[step.category]} ({step.percentage}%)
                {idx < value.length - 1 && ' → '}
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
};