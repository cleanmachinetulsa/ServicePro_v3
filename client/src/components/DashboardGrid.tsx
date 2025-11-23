import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { GripVertical } from "lucide-react";
import { DashboardWidget } from "@/../../shared/schema";

interface SortableWidgetProps {
  id: string;
  children: React.ReactNode;
  isEditMode: boolean;
}

function SortableWidget({ id, children, isEditMode }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {isEditMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -left-10 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-500/20 backdrop-blur-sm rounded p-2 border border-blue-400/50"
          data-testid={`drag-handle-${id}`}
        >
          <GripVertical className="h-5 w-5 text-blue-400" />
        </div>
      )}
      {children}
    </div>
  );
}

interface DashboardGridProps {
  widgets: DashboardWidget[];
  onReorder: (widgets: DashboardWidget[]) => void;
  isEditMode: boolean;
  children: (widget: DashboardWidget) => React.ReactNode;
}

export function DashboardGrid({
  widgets,
  onReorder,
  isEditMode,
  children,
}: DashboardGridProps) {
  const [items, setItems] = useState(widgets);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setItems(widgets);
  }, [widgets]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const reordered = arrayMove(items, oldIndex, newIndex).map(
        (widget, index) => ({
          ...widget,
          order: index,
        })
      );

      setItems(reordered);
      onReorder(reordered);
    }
  };

  const visibleWidgets = items
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={visibleWidgets.map((w) => w.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-6 relative" data-testid="dashboard-grid">
          {isEditMode && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-blue-500/20 backdrop-blur-sm border border-blue-400/50 rounded-lg p-4 mb-4"
              data-testid="edit-mode-banner"
            >
              <p className="text-blue-100 text-sm">
                <strong>Edit Mode:</strong> Drag the grip icons to rearrange your widgets. Click "Done" when finished.
              </p>
            </motion.div>
          )}
          
          {visibleWidgets.map((widget) => (
            <SortableWidget
              key={widget.id}
              id={widget.id}
              isEditMode={isEditMode}
            >
              {children(widget)}
            </SortableWidget>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
