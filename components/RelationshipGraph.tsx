'use client';

import React, { useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import * as d3 from 'd3';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Student, Question, Answer } from '@/lib/supabase';
import { NodeData, LinkData } from '@/app/class/[classId]/page';
import { RELATIONSHIP_COLORS, RELATIONSHIP_TYPES } from '@/lib/constants';

const NODE_RADIUS = 22;

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
  surveyId?: string | null;
}

export interface RelationshipGraphRef {
  triggerLayoutChange: () => void;
}

// 성별별 테두리 색상 정의 (진하게 수정)
const MALE_BORDER_COLOR = '#3b82f6';   // blue-500 
const FEMALE_BORDER_COLOR = '#ec4899'; // pink-500
const DEFAULT_BORDER_COLOR = '#e5e7eb'; // gray-200
const HOVER_BORDER_COLOR = '#d1d5db';   // gray-300 (Hover 시)

async function updateStudentPosition(studentId: string, x: number | null, y: number | null): Promise<Student | null> {
    const { data, error } = await (supabase as any)
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
    surveyId,
  },
  ref
) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<NodeData, LinkData> | null>(null);
  const containerRef = useRef<SVGGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const initialFitDoneRef = useRef(false);
  const currentTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const isDraggingRef = useRef(false);
  const queryClient = useQueryClient();

  const updateNodePositionMutation = useMutation<Student | null, Error, { studentId: string; x: number | null; y: number | null }>({
      mutationFn: ({ studentId, x, y }) => updateStudentPosition(studentId, x, y),
      onSuccess: (updatedStudent) => {
          if (!updatedStudent) return;
          queryClient.setQueryData<NodeData[]>(['students', classId], (oldData) => {
              return oldData?.map(node =>
                  node.id === updatedStudent.id
                      ? { ...node, position_x: updatedStudent.position_x, position_y: updatedStudent.position_y }
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
      let startX = 0;
      let startY = 0;
      let hasMoved = false;
      
      function dragstarted(event: d3.D3DragEvent<SVGGElement, NodeData, any>, d: NodeData & { isNewlyPlaced?: boolean }) {
          console.log('🚀 Drag started for node:', d.name);
          startX = event.x;
          startY = event.y;
          hasMoved = false;
          
          if (d.isNewlyPlaced) {
              console.log(`Releasing fixed position for NEW node: ${d.name}`);
              d.fx = null;
              d.fy = null;
              d.isNewlyPlaced = false;
          }
          if (!event.active) simulation?.alphaTarget(0.3).restart();
      }
      
      function dragged(event: d3.D3DragEvent<SVGGElement, NodeData, any>, d: NodeData) {
          const distance = Math.sqrt(
              Math.pow(event.x - startX, 2) + Math.pow(event.y - startY, 2)
          );
          
          if (distance > 5) { // 5px 이상 움직이면 드래그로 인식
              hasMoved = true;
              isDraggingRef.current = true;
              d.fx = event.x;
              d.fy = event.y;
          }
      }
      
      function dragended(event: d3.D3DragEvent<SVGGElement, NodeData, any>, d: NodeData) {
          console.log('🏁 Drag ended for node:', d.name, 'hasMoved:', hasMoved, 'currentSelectedId:', selectedNodeId);
          if (!event.active) simulation?.alphaTarget(0);
          
          if (hasMoved) {
              // 실제 드래그인 경우
              const finalX = d.fx;
              const finalY = d.fy;
              
              if (finalX != null && finalY != null) {
                  updateNodePositionMutation.mutate({ studentId: d.id, x: finalX, y: finalY });
              }
              
              // 드래그 후 상태 해제
              setTimeout(() => {
                  isDraggingRef.current = false;
                  console.log('🔄 Drag state cleared for node:', d.name);
              }, 50);
          } else {
              // 클릭으로 처리 - 약간의 지연을 두어 상태가 안정화되도록 함
              console.log('👆 Click detected for node:', d.name, 'currentSelectedId:', selectedNodeId);
              isDraggingRef.current = false;
              
              // 현재 선택된 노드 ID를 저장 (클로저로 캡처)
              const currentSelected = selectedNodeId;
              
                             setTimeout(() => {
                  // 현재 선택된 노드 ID 정규화 (null, undefined -> null)
                  const normalizedSelected = currentSelected || null;
                  const isCurrentlySelected = normalizedSelected === d.id;
                  
                  console.log('🔍 Selection check - nodeId:', d.id, 'currentSelected:', currentSelected, 'normalizedSelected:', normalizedSelected, 'isCurrentlySelected:', isCurrentlySelected);
                  
                  if (isCurrentlySelected) { 
                      console.log('🔄 Deselecting node:', d.name, '(was selected)');
                      onNodeClick(null); 
                  } else { 
                      console.log('🎯 Selecting node:', d.name, '(was not selected, current selected:', normalizedSelected, ')');
                      onNodeClick(d); 
                  }
              }, 0);
          }
      }
      
      return d3.drag<SVGGElement, NodeData>()
          .filter((event) => {
              return event.button === 0;
          })
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended);
  }

  // --- Fit to Bounds 함수 수정 (내부 상태 직접 업데이트 제거) ---
  const fitToBounds = useCallback(() => {
      console.log("fitToBounds function called.");
      if (!svgRef.current || !containerRef.current || !zoomRef.current || !nodes) {
          console.log("fitToBounds: Missing refs or nodes. Aborting.");
          return;
      }

      const svg = d3.select(svgRef.current!);
      const containerSelection = d3.select(containerRef.current);
      const nodeElements = containerSelection.selectAll<SVGGElement, NodeData>('.node-group').data();

      console.log(`fitToBounds: Found ${nodeElements.length} node elements.`);
      if (nodeElements.length === 0) return;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let validCoordsFound = false;

      nodeElements.forEach((node, i) => {
          const x = node.x ?? node.position_x;
          const y = node.y ?? node.position_y;
          if (typeof x === 'number' && !isNaN(x) && typeof y === 'number' && !isNaN(y)) {
              minX = Math.min(minX, x - NODE_RADIUS);
              minY = Math.min(minY, y - NODE_RADIUS);
              maxX = Math.max(maxX, x + NODE_RADIUS);
              maxY = Math.max(maxY, y + NODE_RADIUS);
              validCoordsFound = true;
          }
      });

      if (!validCoordsFound) {
          console.log("fitToBounds: No valid coordinates found for any node. Aborting.");
          return;
      }
      console.log(`fitToBounds: Bounds calculated: minX=${minX}, minY=${minY}, maxX=${maxX}, maxY=${maxY}`);

      const bboxWidth = maxX - minX;
      const bboxHeight = maxY - minY;

      if (bboxWidth <= 0 || bboxHeight <= 0) {
         console.log("fitToBounds: Invalid bounds width or height. Aborting.");
         return;
      }

      const padding = 0.90;
      const scale = padding * Math.min(width / bboxWidth, height / bboxHeight);
      const [minScale, maxScale] = zoomRef.current.scaleExtent();
      const clampedScale = Math.max(minScale, Math.min(maxScale, scale));
      console.log(`fitToBounds: Calculated scale=${scale}, clampedScale=${clampedScale}`);

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const translateX = width / 2 - clampedScale * centerX;
      const translateY = height / 2 - clampedScale * centerY;
      console.log(`fitToBounds: Calculated translate=(${translateX}, ${translateY})`);

      const targetTransform = d3.zoomIdentity.translate(translateX, translateY).scale(clampedScale);
      console.log("fitToBounds: Applying target transform:", targetTransform);

      // 시각적 전환만 적용
      svg.transition()
          .duration(750)
          .call(zoomRef.current!.transform, targetTransform)
          .on("end", () => console.log("fitToBounds: Transition ended."));
      
      // *** 제거: 줌 동작의 내부 상태 직접 업데이트 ***
      // zoomRef.current.transform(svg, targetTransform);
      // 대신, 전환 완료 시 또는 즉시 currentTransformRef 업데이트 (선택적)
      // currentTransformRef.current = targetTransform; // 필요 시 추가

  }, [nodes, width, height]);

  // Effect 1: 초기 설정
  useEffect(() => {
    if (!svgRef.current) return;
    
    // 드래그 상태 초기화
    isDraggingRef.current = false;
    console.log('📍 Component initialized, isDragging:', isDraggingRef.current);
    
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // SVG 배경 클릭/더블클릭 이벤트
    svg.on('click', (event) => {
        if (event.target === svgRef.current) {
            onNodeClick(null);
        }
    })
    .on('dblclick', (event) => {
        console.log("SVG dblclick detected, target:", event.target);
        if (event.target === svgRef.current || event.target === containerRef.current) {
            console.log("Background or container double-clicked, calling fitToBounds...");
            fitToBounds(); // 이제 함수가 정의된 후에 호출됨
        }
    });

    // --- 마커 정의 --- 
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

    // --- 그림자 필터 정의 --- 
    const filter = defs.append("filter")
        .attr("id", "drop-shadow")
        .attr("height", "130%");
    filter.append("feGaussianBlur") // 흐림 효과
        .attr("in", "SourceAlpha")
        .attr("stdDeviation", 2)
        .attr("result", "blur");
    filter.append("feOffset") // 그림자 오프셋
        .attr("in", "blur")
        .attr("dx", 1)
        .attr("dy", 1)
        .attr("result", "offsetBlur");
    const feMerge = filter.append("feMerge"); // 원본과 그림자 합치기
    feMerge.append("feMergeNode")
        .attr("in", "offsetBlur")
    feMerge.append("feMergeNode")
        .attr("in", "SourceGraphic");

    // --- 컨테이너 그룹 생성 및 저장 ---
    const g = svg.append("g"); // g 요소 먼저 생성
    containerRef.current = g.node(); // ref에 할당
    // 초기 transform 적용
    g.attr('transform', currentTransformRef.current.toString());

    // --- 줌 설정 및 Ref에 저장 (필터 수정) --- 
    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        // D3 기본 필터 사용 또는 드래그 허용하도록 수정
        // .filter(event => event.type === 'wheel') // 이전 필터 제거
        .filter(event => !event.ctrlKey && !event.button) // D3 기본 필터 (드래그 허용)
        .on("zoom", (event) => {
            if (containerRef.current) {
                d3.select(containerRef.current).attr("transform", event.transform.toString());
                currentTransformRef.current = event.transform;
            }
        });
    
    svg.call(zoom as any);
    svg.on("dblclick.zoom", null);
    zoomRef.current = zoom;

    // --- 시뮬레이션 생성 및 힘 설정 --- 
    simulationRef.current = d3.forceSimulation<NodeData, LinkData>()
      .force("link", d3.forceLink<NodeData, LinkData>([]).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-150))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(NODE_RADIUS + 5))
      .velocityDecay(0.5)
      .on("tick", () => {
        if (!containerRef.current) return;
        const containerSelection = d3.select(containerRef.current);

        // 링크 위치 업데이트 (NODE_RADIUS 변경 반영)
        containerSelection.selectAll<SVGPathElement, ProcessedLinkData>(".link-path")
            .attr("d", d => {
                const sourceNode = d.source as unknown as NodeData;
                const targetNode = d.target as unknown as NodeData;
                if (!sourceNode || !targetNode || typeof sourceNode.x !== 'number' || typeof sourceNode.y !== 'number' || typeof targetNode.x !== 'number' || typeof targetNode.y !== 'number') return null;
                const dx = targetNode.x - sourceNode.x; const dy = targetNode.y - sourceNode.y; const dist = Math.sqrt(dx * dx + dy * dy);
                // 링크 오프셋 계산 시 NODE_RADIUS 사용
                if (dist < NODE_RADIUS * 2) return null; 
                const targetOffset = NODE_RADIUS;
                const sourceOffset = NODE_RADIUS;
                const targetRatio = (dist > 0) ? (dist - targetOffset) / dist : 0; const targetX_straight = sourceNode.x + dx * targetRatio; const targetY_straight = sourceNode.y + dy * targetRatio;
                const sourceRatio = (dist > 0) ? sourceOffset / dist : 0; const sourceX_straight = sourceNode.x + dx * sourceRatio; const sourceY_straight = sourceNode.y + dy * sourceRatio;
                const curvature = 0.025; const midX = (sourceNode.x + targetNode.x) / 2; const midY = (sourceNode.y + targetNode.y) / 2; const offsetX = dy * curvature; const offsetY = -dx * curvature; const controlX = midX + offsetX; const controlY = midY + offsetY;
                return `M${sourceX_straight},${sourceY_straight}Q${controlX},${controlY} ${targetX_straight},${targetY_straight}`;
            });

        // 노드 위치 업데이트
        containerSelection.selectAll<SVGGElement, NodeData>(".node-group")
            .attr("transform", d => {
                const x = typeof d.x === 'number' ? d.x : width / 2;
                const y = typeof d.y === 'number' ? d.y : height / 2;
                return `translate(${x},${y})`;
            });
      });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, onNodeClick, fitToBounds]);

  // Effect 2: 데이터 업데이트
  useEffect(() => {
    if (!simulationRef.current || !containerRef.current || !nodes || !links) return;

    const containerSelection = d3.select(containerRef.current);
    const color = (type: keyof typeof RELATIONSHIP_COLORS) => RELATIONSHIP_COLORS[type] || '#999';

    // --- 노드/링크 데이터 처리 ---
    let anchorX = width / 2; let anchorY = height / 2;
    // ... (anchorX, anchorY 계산 로직) ...

    // --- 노드 데이터 처리: 새 노드만 식별하여 fx, fy 설정 ---
    const currentNodes = nodes.map(n => { 
        // isNewlyPlaced 플래그는 여기서 초기화하지 않고, 
        // 새로 식별될 때만 true로 설정하거나 dragstarted에서 false로 만듦.
        return {...n};
    }) as (NodeData & { isNewlyPlaced?: boolean })[]; 
    
    currentNodes.forEach(node => {
        const hasDbPosition = node.position_x != null && node.position_y != null;
        const isCurrentlyFixed = node.fx != null && node.fy != null;

        if (hasDbPosition && !isCurrentlyFixed) {
            // DB 위치가 있는데 아직 고정되지 않았다면 (초기 로드 등)
            console.log(`Fixing node ${node.name} based on DB position.`);
            node.fx = node.position_x;
            node.fy = node.position_y;
            node.isNewlyPlaced = false; // DB 위치 있는 건 새 노드 아님
        } else if (!hasDbPosition && !isCurrentlyFixed && !node.isNewlyPlaced) {
            // DB 위치 없고, 현재 고정 안됐고, isNewlyPlaced 플래그도 없다면 => 새로 추가된 노드!
            const offsetX = (Math.random() - 0.5) * 50;
            const offsetY = (Math.random() - 0.5) * 50;
            node.fx = anchorX + offsetX;
            node.fy = anchorY + offsetY;
            node.isNewlyPlaced = true; // 새로 고정했음 플래그
            console.log(`Set initial FIXED position for NEW node ${node.name}: (${node.fx}, ${node.fy})`);
        } 
        // else: DB 위치 없지만 이미 isNewlyPlaced=true 거나 fx/fy가 있는 경우 -> 유지
        // else: DB 위치 있고 fx/fy도 있는 경우 -> 유지
    });

    // --- 링크 데이터 처리 (유효성 검사 유지) ---
    const nodeIds = new Set(currentNodes.map(n => n.id));
    // finalProcessedLinks 계산 (이전 로직 유지)
    const linkPairs = new Map<string, { link: ProcessedLinkData, index: number }>();
    const finalProcessedLinks: ProcessedLinkData[] = links.map((link, i): ProcessedLinkData => {
      const sourceId = typeof link.source === 'object' ? (link.source as NodeData).id : link.source as string;
      const targetId = typeof link.target === 'object' ? (link.target as NodeData).id : link.target as string;
      const key1 = `${sourceId}-${targetId}`; const key2 = `${targetId}-${sourceId}`;
      let isMutual = false; let pairIndex = 0;
      const pairInfo = linkPairs.get(key2);
      if (pairInfo) { isMutual = true; pairInfo.link.isMutual = true; pairInfo.link.pairIndex = 0; pairIndex = 1; linkPairs.delete(key2); } else { const currentLinkProcessed = { ...link, id: `link-${key1}`, isMutual, pairIndex } as ProcessedLinkData; linkPairs.set(key1, { link: currentLinkProcessed, index: i }); }
      return { ...link, id: `link-${key1}`, isMutual, pairIndex } as ProcessedLinkData;
    });
    linkPairs.forEach(pairInfo => { if (finalProcessedLinks[pairInfo.index]) { finalProcessedLinks[pairInfo.index].isMutual = false; finalProcessedLinks[pairInfo.index].pairIndex = 0; }});
    // 유효 링크 필터링
    const validLinks = finalProcessedLinks.filter(link => {
        const sourceId = typeof link.source === 'object' ? (link.source as NodeData).id : link.source as string;
        const targetId = typeof link.target === 'object' ? (link.target as NodeData).id : link.target as string;
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    // --- 시뮬레이션 업데이트 ---
    simulationRef.current.nodes(currentNodes as NodeData[]);
    simulationRef.current.force<d3.ForceLink<NodeData, LinkData>>("link")?.links(validLinks);

    // --- SVG 요소 업데이트 (.join 사용) ---
    const linkSelection = containerSelection.selectAll<SVGPathElement, ProcessedLinkData>(".link-path")
      .data(validLinks, d => d.id)
      .join(
          enter => enter.append("path")
              .attr("class", "link-path")
              .attr("fill", "none")
              .attr("stroke-opacity", 0.6)
              .attr("stroke-width", 1.5)
              .attr("stroke", d => color(d.type))
              .attr('marker-end', d => `url(#arrowhead-${d.type})`),
          update => update, // 업데이트 시 특별한 변경 없으면 간단히 처리
          exit => exit.remove()
      );

    const nodeGroupSelection = containerSelection.selectAll<SVGGElement, NodeData>(".node-group")
      .data(currentNodes, d => d.id)
      .join(
          enter => {
              const g = enter.append("g")
                  .attr("class", "node-group cursor-pointer")
                  .style("filter", "url(#drop-shadow)")
                  .call(drag(simulationRef.current));
              
              // 노드 원 (반경 업데이트됨)
              g.append("circle")
                  .attr("r", NODE_RADIUS)
                  .attr("fill", 'white')
                  .attr("stroke", d => 
                      d.gender === 'male' ? MALE_BORDER_COLOR : 
                      d.gender === 'female' ? FEMALE_BORDER_COLOR : 
                      DEFAULT_BORDER_COLOR
                  )
                  .attr("stroke-width", 1);
              
              // 노드 텍스트: font-size 및 weight 증가
              g.append("text")
                  .attr("x", 0).attr("y", "0.31em").attr("text-anchor", "middle")
                  .text(d => d.name)
                  .style("font-size", "12px") // 11px -> 12px
                  .style("font-weight", "600") // 500 -> 600 (semibold)
                  .style("fill", "#4b5563")
                  .style("pointer-events", "none");
              

                
              // Hover 효과: 기본 테두리일 때만 변경
              g.on('mouseover', function(event, d) {
                  const circle = d3.select(this).select('circle');
                  const currentStroke = circle.attr('stroke');
                  if (selectedNodeId !== d.id && currentStroke === DEFAULT_BORDER_COLOR) {
                      circle.transition().duration(150).attr('stroke', HOVER_BORDER_COLOR);
                  }
              })
              .on('mouseout', function(event, d) {
                  const circle = d3.select(this).select('circle');
                  // 선택되지 않았고, 호버 효과가 적용된 기본 테두리였다면 원래대로 복구
                  if (selectedNodeId !== d.id && circle.attr('stroke') === HOVER_BORDER_COLOR) {
                      circle.transition().duration(150).attr('stroke', DEFAULT_BORDER_COLOR);
                  }
              });
              return g;
          },
          update => {
              update.select('text').text(d => d.name);
              // 선택 해제 시 gender 기반 스타일 복구
              update.filter(d => d.id !== selectedNodeId)
                  .select('circle')
                  .attr("fill", "white")
                  .attr("stroke", d => 
                      d.gender === 'male' ? MALE_BORDER_COLOR : 
                      d.gender === 'female' ? FEMALE_BORDER_COLOR : 
                      DEFAULT_BORDER_COLOR
                  )
                  .attr("stroke-width", 1);
              update.filter(d => d.id !== selectedNodeId)
                  .select('text')
                  .style("fill", "#4b5563");
              return update;
          },
          exit => exit.remove()
      );

    // --- 시뮬레이션 재시작 ---
    simulationRef.current.alpha(1).restart();

    // --- 초기 로드 시 Fit to Bounds 실행 (이전 상태 유지) ---
    if (nodes && nodes.length > 0 && !initialFitDoneRef.current) {
        const timer = setTimeout(() => {
            fitToBounds();
            initialFitDoneRef.current = true;
        }, 100);
        return () => clearTimeout(timer);
    }

  }, [nodes, links, width, height, classId, selectedNodeId, fitToBounds]);

  // Effect 3: 노드 선택 시 하이라이팅
  useEffect(() => {
    if (!containerRef.current) return;
    const containerSelection = d3.select(containerRef.current);

    // 선택 해제 시
    if (!selectedNodeId) {
        containerSelection.selectAll(".node-group")
            .attr("opacity", 1)
            .select("circle")
            .attr("fill", "white")
            // gender 기반 테두리 복구
            .attr("stroke", d => {
                const node = d as NodeData;
                return node.gender === 'male' ? MALE_BORDER_COLOR : 
                       node.gender === 'female' ? FEMALE_BORDER_COLOR : 
                       DEFAULT_BORDER_COLOR;
            })
            .attr("stroke-width", 1);
        containerSelection.selectAll(".node-group text")
            .style("fill", "#4b5563"); // 기본 텍스트 색
        containerSelection.selectAll(".link-path")
            .attr("opacity", 1);
        return;
    }
    
    if (!nodes || !links) return;

    // 연결된 노드 찾기
    const connectedNodeIds = new Set<string>([selectedNodeId]);
    const getSourceId = (link: LinkData): string => typeof link.source === 'object' ? (link.source as NodeData).id : link.source as string;
    const getTargetId = (link: LinkData): string => typeof link.target === 'object' ? (link.target as NodeData).id : link.target as string;
    links.forEach(link => {
        const sourceId = getSourceId(link);
        const targetId = getTargetId(link);
        if (sourceId === selectedNodeId) connectedNodeIds.add(targetId);
        if (targetId === selectedNodeId) connectedNodeIds.add(sourceId);
    });

    // 노드/링크 투명도 조절 (opacity-30)
    containerSelection.selectAll<SVGGElement, NodeData>(".node-group")
        .attr("opacity", d => connectedNodeIds.has(d.id) ? 1 : 0.3);
    containerSelection.selectAll<SVGPathElement, ProcessedLinkData>(".link-path")
        .attr("opacity", l => {
            const sourceId = getSourceId(l as LinkData); // 타입 단언 주의
            const targetId = getTargetId(l as LinkData);
            return (sourceId === selectedNodeId || targetId === selectedNodeId) ? 1 : 0.1;
        });

    // 선택된 노드 스타일
    containerSelection.selectAll<SVGGElement, NodeData>(".node-group")
      .filter(d => d.id === selectedNodeId)
      .select("circle")
      .attr("fill", '#818cf8') // indigo-400 (연하게 변경)
      .attr("stroke", "none")
      .attr("stroke-width", 0);
    
    containerSelection.selectAll<SVGGElement, NodeData>(".node-group")
        .filter(d => d.id === selectedNodeId)
        .select("text")
        .style("fill", "white");

    // 선택되지 않은 노드 스타일 확인 및 gender 기반 테두리 적용
    containerSelection.selectAll<SVGGElement, NodeData>(".node-group")
      .filter(d => d.id !== selectedNodeId)
      .select("circle")
      .attr("fill", "white")
      .attr("stroke", d => 
          d.gender === 'male' ? MALE_BORDER_COLOR : 
          d.gender === 'female' ? FEMALE_BORDER_COLOR : 
          DEFAULT_BORDER_COLOR
      )
      .attr("stroke-width", 1);
    containerSelection.selectAll<SVGGElement, NodeData>(".node-group")
      .filter(d => d.id !== selectedNodeId)
      .select("text")
      .style("fill", "#4b5563");

    // 선택된 노드 맨 위로
    containerSelection.selectAll<SVGGElement, NodeData>(".node-group")
      .filter(d => d.id === selectedNodeId)
      .raise();

  }, [selectedNodeId, nodes, links]);

  return (
    <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      {/* SVG 내용은 Effect에서 동적으로 생성됨 */}
    </svg>
  );
});

RelationshipGraph.displayName = 'RelationshipGraph';
export default RelationshipGraph;