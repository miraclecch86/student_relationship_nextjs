'use client';

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import * as d3 from 'd3';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Student } from '@/lib/supabase';
import { NodeData, LinkData } from '@/app/class/[classId]/page';
import { RELATIONSHIP_COLORS, RELATIONSHIP_TYPES } from '@/lib/constants';

const NODE_RADIUS = 20;

// 확장된 링크 데이터 타입
interface ProcessedLinkData extends LinkData {
  id: string;
  isMutual: boolean;
  pairIndex: number;
}

interface RelationshipGraphProps {
  nodes: NodeData[];
  links: LinkData[];
  onNodeClick: (node: NodeData | null) => void;
  selectedNodeId?: string | null;
  width?: number;
  height?: number;
  classId: string;
}

export interface RelationshipGraphRef {
  triggerLayoutChange: () => void;
}

async function updateStudentPosition(studentId: string, x: number | null, y: number | null): Promise<Student | null> {
    const { data, error } = await supabase
        .from('students')
        .update({ position_x: x, position_y: y })
        .eq('id', studentId)
        .select()
        .single();
    if (error) {
        console.error(`Failed to update position for student ${studentId}:`, error.message);
    }
    return data;
}

const RelationshipGraph = forwardRef<RelationshipGraphRef, RelationshipGraphProps>((
  {
    nodes,
    links,
    onNodeClick,
    selectedNodeId,
    width = 800,
    height = 600,
    classId,
  },
  ref
) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<NodeData, LinkData> | null>(null);
  const queryClient = useQueryClient();

  const updateNodePositionMutation = useMutation<Student | null, Error, { studentId: string; x: number | null; y: number | null }>({
      mutationFn: ({ studentId, x, y }) => updateStudentPosition(studentId, x, y),
      onSuccess: (updatedStudent) => {
          if (!updatedStudent) return;
          queryClient.setQueryData<NodeData[]>(['students', classId], (oldData) => {
              return oldData?.map(node =>
                  node.id === updatedStudent.id
                      ? { ...node, position_x: updatedStudent.position_x, position_y: updatedStudent.position_y, fx: updatedStudent.position_x, fy: updatedStudent.position_y }
                      : node
              );
          });
      },
      onError: (error) => {
          console.error("Position update failed:", error);
      },
  });

  useImperativeHandle(ref, () => ({
    triggerLayoutChange: () => {
      if (simulationRef.current) {
          nodes.forEach(node => {
              if (!node.fx) {
              }
          });
        simulationRef.current.alpha(0.5).restart();
      }
    }
  }));

  const drag = (simulation: d3.Simulation<NodeData, LinkData> | null) => {
      function dragstarted(event: d3.D3DragEvent<SVGGElement, NodeData, any>, d: NodeData) {
        if (!event.active) simulation?.alphaTarget(0.3).restart();
        d.fx = typeof d.x === 'number' ? d.x : null;
        d.fy = typeof d.y === 'number' ? d.y : null;
      }

      function dragged(event: d3.D3DragEvent<SVGGElement, NodeData, any>, d: NodeData) {
        d.fx = event.x;
        d.fy = event.y;
      }

      function dragended(event: d3.D3DragEvent<SVGGElement, NodeData, any>, d: NodeData) {
        if (!event.active) simulation?.alphaTarget(0);

        const finalX = d.fx;
        const finalY = d.fy;

        if (finalX != null && finalY != null && (finalX !== d.position_x || finalY !== d.position_y)) {
            updateNodePositionMutation.mutate({ studentId: d.id, x: finalX, y: finalY });
        }
      }

      return d3.drag<SVGGElement, NodeData>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
  }

  useEffect(() => {
    if (!svgRef.current || !nodes || !links) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const defs = svg.append('defs');
    const markerBoxWidth = 5;
    const markerBoxHeight = 5;
    const refX = markerBoxWidth;
    const arrowPoints: [number, number][] = [[0, -markerBoxHeight / 2], [markerBoxWidth, 0], [0, markerBoxHeight / 2]];
    const arrowPath = d3.line()(arrowPoints);

    Object.entries(RELATIONSHIP_COLORS).forEach(([key, colorValue]) => {
      defs.append('marker')
        .attr('id', `arrowhead-${key}`)
        .attr('viewBox', [0, -markerBoxHeight / 2, markerBoxWidth, markerBoxHeight])
        .attr('refX', refX)
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', markerBoxWidth)
        .attr('markerHeight', markerBoxHeight)
        .attr('xoverflow', 'visible')
        .append('svg:path')
        .attr('d', arrowPath)
        .attr('fill', colorValue)
        .style('stroke', 'none');
    });
    defs.append('marker')
        .attr('id', 'arrowhead-default')
        .attr('viewBox', [0, -markerBoxHeight / 2, markerBoxWidth, markerBoxHeight])
        .attr('refX', refX)
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', markerBoxWidth)
        .attr('markerHeight', markerBoxHeight)
        .attr('xoverflow', 'visible')
        .append('svg:path')
        .attr('d', arrowPath)
        .attr('fill', '#999')
        .style('stroke', 'none');

    const container = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            container.attr("transform", event.transform);
        });

    svg.call(zoom as any);

    const color = (type: keyof typeof RELATIONSHIP_COLORS) => RELATIONSHIP_COLORS[type] || '#999';

    const nodeMap = new Map(nodes.map(node => [node.id, node]));

    nodes.forEach(node => {
        if (node.position_x != null) node.fx = node.position_x;
        if (node.position_y != null) node.fy = node.position_y;
    });

    // --- 링크 데이터 사전 처리 (쌍방향 식별) ---
    const linkPairs = new Map<string, { link: ProcessedLinkData, index: number }>();
    const processedLinks: ProcessedLinkData[] = links.map((link, i): ProcessedLinkData => {
      const sourceId = typeof link.source === 'object' ? (link.source as NodeData).id : link.source as string;
      const targetId = typeof link.target === 'object' ? (link.target as NodeData).id : link.target as string;
      const key1 = `${sourceId}-${targetId}`; const key2 = `${targetId}-${sourceId}`;
      let isMutual = false; let pairIndex = 0;
      const pairInfo = linkPairs.get(key2);
      if (pairInfo) {
        isMutual = true; pairInfo.link.isMutual = true; pairInfo.link.pairIndex = 0;
        pairIndex = 1; linkPairs.delete(key2);
      } else {
        const currentLinkProcessed = { ...link, id: `link-${key1}`, isMutual, pairIndex } as ProcessedLinkData;
        linkPairs.set(key1, { link: currentLinkProcessed, index: i });
      }
      return { ...link, id: `link-${key1}`, isMutual, pairIndex } as ProcessedLinkData;
    });
    linkPairs.forEach(pairInfo => { // Map에 남은 단방향 링크 확정
        if (processedLinks[pairInfo.index]) {
            processedLinks[pairInfo.index].isMutual = false;
            processedLinks[pairInfo.index].pairIndex = 0;
        }
    });
    // --- 링크 데이터 처리 끝 ---

    simulationRef.current = d3.forceSimulation<NodeData, LinkData>(nodes)
      .force("link", d3.forceLink<NodeData, LinkData>(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-150))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = container.append("g")
      .attr("fill", "none")
      .attr("stroke-opacity", 0.6)
      .selectAll("path")
      .data(processedLinks, (d: unknown) => (d as ProcessedLinkData).id)
      .join("path")
      .attr("stroke-width", 1.5)
      .attr("stroke", d => color(d.type))
      .attr('marker-end', d => `url(#arrowhead-${d.type})`);

    const nodeGroup = container.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll<SVGGElement, NodeData>("g")
      .data(nodes, d => d.id)
      .join("g")
      .attr("class", "node-group cursor-pointer")
      .call(drag(simulationRef.current));

    nodeGroup.append("circle")
      .attr("r", NODE_RADIUS)
      .attr("fill", '#60a5fa');

    nodeGroup.append("text")
      .attr("x", 0)
      .attr("y", "0.31em")
      .attr("text-anchor", "middle")
      .text(d => d.name)
      .style("font-size", "10px")
      .style("fill", "#333")
      .style("pointer-events", "none");

    nodeGroup.on("click", (event, d) => {
      event.stopPropagation();
      if (selectedNodeId === d.id) {
        onNodeClick(null);
      } else {
        onNodeClick(d);
      }
    });

    simulationRef.current.on("tick", () => {
      link.attr("d", d => {
        const sourceNode = d.source as unknown as NodeData;
        const targetNode = d.target as unknown as NodeData;

        if (!sourceNode.x || !sourceNode.y || !targetNode.x || !targetNode.y) return null;

        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < NODE_RADIUS) return null;

        const targetOffset = NODE_RADIUS;
        const sourceOffset = NODE_RADIUS;

        const targetRatio = (dist > 0) ? (dist - targetOffset) / dist : 0;
        const targetX_straight = sourceNode.x + dx * targetRatio;
        const targetY_straight = sourceNode.y + dy * targetRatio;

        const sourceRatio = (dist > 0) ? sourceOffset / dist : 0;
        const sourceX_straight = sourceNode.x + dx * sourceRatio;
        const sourceY_straight = sourceNode.y + dy * sourceRatio;

        const curvature = 0.025;
        const midX = (sourceNode.x + targetNode.x) / 2;
        const midY = (sourceNode.y + targetNode.y) / 2;
        const offsetX = dy * curvature;
        const offsetY = -dx * curvature;
        const controlX = midX + offsetX;
        const controlY = midY + offsetY;

        return `M${sourceX_straight},${sourceY_straight}Q${controlX},${controlY} ${targetX_straight},${targetY_straight}`;
      });

      nodeGroup.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

  }, [nodes, links, width, height, onNodeClick, selectedNodeId, classId]);

  useEffect(() => {
    if (!svgRef.current || !nodes || !links) return;
    const svg = d3.select(svgRef.current);

    svg.selectAll<SVGGElement, NodeData>(".node-group")
        .select("circle")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .attr("opacity", 1);
    svg.selectAll("path")
        .filter((d: any) => d && (d as ProcessedLinkData).source)
        .attr("stroke-opacity", 0.6)
        .attr("opacity", 1);
    svg.selectAll<SVGGElement, NodeData>(".node-group")
        .select("text")
        .attr("opacity", 1);

    if (selectedNodeId) {
      const connectedNodeIds = new Set<string>([selectedNodeId]);
      const currentLinks = links;

      const getSourceId = (link: LinkData): string => typeof link.source === 'object' ? (link.source as NodeData).id : link.source as string;
      const getTargetId = (link: LinkData): string => typeof link.target === 'object' ? (link.target as NodeData).id : link.target as string;

      currentLinks.forEach(link => {
          const sourceId = getSourceId(link);
          const targetId = getTargetId(link);
          if (sourceId === selectedNodeId) connectedNodeIds.add(targetId);
          if (targetId === selectedNodeId) connectedNodeIds.add(sourceId);
      });

      svg.selectAll<SVGGElement, NodeData>(".node-group")
          .attr("opacity", d => connectedNodeIds.has(d.id) ? 1 : 0.2);

      svg.selectAll("path")
          .filter((d: any) => d && (d as ProcessedLinkData).source)
          .each(function(l) {
              const sourceId = getSourceId(l as LinkData);
              const targetId = getTargetId(l as LinkData);
              const isConnected = sourceId === selectedNodeId || targetId === selectedNodeId;
              const targetOpacity = isConnected ? 1 : 0.1;

              d3.select(this)
                  .attr("opacity", targetOpacity);
          });

      svg.selectAll<SVGGElement, NodeData>(".node-group")
        .filter(d => d.id === selectedNodeId)
        .raise()
        .select("circle")
        .attr("stroke", '#f59e0b')
        .attr("stroke-width", 4);
    }

  }, [selectedNodeId, nodes, links]);

  return (
    <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
    </svg>
  );
});

RelationshipGraph.displayName = 'RelationshipGraph';
export default RelationshipGraph;
