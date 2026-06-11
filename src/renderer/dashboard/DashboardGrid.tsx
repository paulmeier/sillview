import {
  ResponsiveGridLayout,
  useContainerWidth,
  type Layout,
} from 'react-grid-layout';
import { WidgetHost } from './WidgetHost';
import { useActiveDashboard, useDashboards, type GridItem } from '../store/dashboards';

export function DashboardGrid() {
  const dashboard = useActiveDashboard();
  const editing = useDashboards((s) => s.editing);
  const setLayout = useDashboards((s) => s.setLayout);
  const { width, containerRef, mounted } = useContainerWidth();

  if (!dashboard) return null;

  // In view mode every item is `static` (no drag/resize); in edit mode the
  // header acts as the drag handle and a resize handle appears bottom-right.
  const items: GridItem[] = editing
    ? dashboard.layout
    : dashboard.layout.map((it) => ({ ...it, static: true }));

  return (
    <div ref={containerRef} className="h-full">
      {mounted && dashboard.widgets.length > 0 && (
        <ResponsiveGridLayout
          width={width}
          breakpoints={{ lg: 0 }}
          cols={{ lg: 12 }}
          rowHeight={56}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          layouts={{ lg: items }}
          dragConfig={{
            handle: '.widget-drag-handle',
            cancel: '.widget-no-drag',
            enabled: editing,
          }}
          resizeConfig={{ handles: ['se'] }}
          onLayoutChange={(layout: Layout) => {
            if (!editing) return;
            setLayout(
              layout.map((l) => ({
                i: l.i,
                x: l.x,
                y: l.y,
                w: l.w,
                h: l.h,
                minW: l.minW,
                minH: l.minH,
              })),
            );
          }}
        >
          {dashboard.widgets.map((w) => (
            <div key={w.id}>
              <WidgetHost instance={w} />
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
