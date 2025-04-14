'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  Input,
  HStack,
  Flex,
  useToast,
  InputGroup,
  InputRightElement,
  SimpleGrid,
  Center,
} from '@chakra-ui/react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import type { Class, Student, Relationship } from '@/lib/supabase';

// ForceGraph2D를 클라이언트 사이드에서만 로드하도록 동적 임포트
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { 
  ssr: false,
  loading: () => <Box bg="white" p={4} borderRadius="md" textAlign="center">그래프 로딩 중...</Box>
});

interface GraphData {
  nodes: Array<{
    id: string;
    name: string;
    val: number;
    group?: string;
  }>;
  links: Array<{
    source: string;
    target: string;
    type: string;
    color?: string;
  }>;
}

export default function RelationshipsPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const graphRef = useRef<any>();
  const queryClient = useQueryClient();
  const classId = typeof params.id === 'string' ? Number(params.id) : Array.isArray(params.id) ? Number(params.id[0]) : 0;
  const [selectedRelationshipType, setSelectedRelationshipType] = useState<string | null>(null);
  const [searchName, setSearchName] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);

  // 클라이언트 사이드 렌더링 확인
  useEffect(() => {
    setIsClient(true);
  }, []);

  const { data: class_ } = useQuery({
    queryKey: ['class', classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();
      
      if (error) throw error;
      return data as Class;
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students', classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .order('name');
      
      if (error) throw error;
      return data as Student[];
    },
  });

  const { data: relationships = [] } = useQuery({
    queryKey: ['relationships', classId],
    queryFn: async () => {
      try {
        // 먼저 get_class_relationships 함수 시도
        const { data, error } = await supabase
          .from('get_class_relationships')
          .select('*')
          .eq('class_id', classId);
        
        if (error) throw error;
        return data as Relationship[];
      } catch (fetchError) {
        // 함수가 없다면 직접 relationships 테이블에서 조회
        if (students.length === 0) return [];
        
        const { data, error } = await supabase
          .from('relationships')
          .select('*')
          .or(`student_id.in.(${students.map(s => s.id).join(',')}),friend_id.in.(${students.map(s => s.id).join(',')})`)
        
        if (error) throw error;
        return data as Relationship[];
      }
    },
    enabled: students.length > 0,
  });

  const addStudent = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('students')
        .insert([{ name, class_id: classId }])
        .select();
      
      if (error) throw error;
      return data[0] as Student;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', classId] });
      queryClient.invalidateQueries({ queryKey: ['studentCount', classId] });
      toast({
        title: '학생이 추가되었습니다.',
        status: 'success',
        duration: 3000,
      });
      setSearchName('');
    },
    onError: (error) => {
      toast({
        title: '학생 추가에 실패했습니다.',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    },
  });

  const handleAddStudent = () => {
    if (!searchName.trim()) {
      toast({
        title: '학생 이름을 입력해주세요.',
        status: 'warning',
        duration: 3000,
      });
      return;
    }
    addStudent.mutate(searchName);
  };

  const resetStudents = useMutation({
    mutationFn: async () => {
      if (!confirm('정말로 모든 학생 관계를 초기화하시겠습니까?')) {
        return;
      }
      
      const { error } = await supabase
        .from('relationships')
        .delete()
        .in('student_id', students.map(s => s.id));
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships', classId] });
      toast({
        title: '학생 관계가 초기화되었습니다.',
        status: 'success',
        duration: 3000,
      });
    },
    onError: (error) => {
      toast({
        title: '초기화에 실패했습니다.',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    },
  });

  const getRelationshipColor = (type: string) => {
    switch (type) {
      case '친한': return '#4CD964';
      case '보통': return '#007AFF';
      case '안좋은': return '#FF3B30';
      default: return '#999999';
    }
  };

  const filterByRelationshipType = (type: string | null) => {
    if (!students || !relationships) return;

    // 모든 노드 생성
    const nodes = students.map(student => ({
      id: student.id.toString(),
      name: student.name,
      val: 1,
    }));

    // 기본 링크
    let links = relationships.map(rel => ({
      source: rel.student_id.toString(),
      target: rel.friend_id.toString(),
      type: rel.relationship_type,
      color: getRelationshipColor(rel.relationship_type),
    }));

    // 관계 타입으로 필터링
    if (type) {
      links = links.filter(link => link.type === type);
    }

    setGraphData({ nodes, links });
  };

  useEffect(() => {
    if (students && relationships) {
      filterByRelationshipType(selectedRelationshipType);
    }
  }, [students, relationships, selectedRelationshipType]);

  useEffect(() => {
    if (!graphContainerRef.current) return;
    
    const updateSize = () => {
      if (graphContainerRef.current) {
        setContainerWidth(graphContainerRef.current.offsetWidth);
        setContainerHeight(500); // 고정 높이
      }
    };

    updateSize();
    
    // ResizeObserver 사용하여 컨테이너 크기 변경 감지
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(graphContainerRef.current);
    
    return () => {
      if (graphContainerRef.current) {
        resizeObserver.unobserve(graphContainerRef.current);
      }
    };
  }, [graphContainerRef.current]);

  const handleNodeClick = (node: any) => {
    setSelectedStudent(node.id);
  };

  if (!isClient) {
    return null; // 클라이언트에서만 렌더링
  }

  if (!class_ || !students) {
    return (
      <Container maxW="container.xl" py={8}>
        <Text>로딩 중...</Text>
      </Container>
    );
  }

  // 학생 관련 주간식 데이터 가져오기
  const getWeeklyFormData = () => {
    if (!selectedStudent) return [];
    
    const student = students.find(s => s.id.toString() === selectedStudent);
    if (!student || !student.weekly_form_data) return [];
    
    const formData = student.weekly_form_data;
    return Object.entries(formData).map(([question, answer]) => ({
      question,
      answer: answer || '학생을 선택해주세요'
    }));
  };

  const weeklyFormData = getWeeklyFormData();

  const getFormItemColor = (question: string) => {
    if (question.includes('좋은 이유')) return 'bg-green-50 border-green-100';
    if (question.includes('불편한 이유') || question.includes('싫은 이유')) return 'bg-red-50 border-red-100';
    if (question.includes('행복')) return 'bg-blue-50 border-blue-100';
    if (question.includes('불행')) return 'bg-purple-50 border-purple-100';
    return 'bg-gray-50 border-gray-100';
  };

  return (
    <Box bg="gray.50" minH="100vh" py={4}>
      <Container maxW="container.xl">
        <Center mb={8}>
          <Heading size="lg">학생 관계도</Heading>
        </Center>
        
        {/* 검색 및 추가 섹션 */}
        <Box bg="white" p={4} borderRadius="lg" boxShadow="0px 2px 8px rgba(0, 0, 0, 0.08)" mb={4}>
          <Flex align="center" gap={4}>
            <Button 
              colorScheme="purple" 
              size="md" 
              borderRadius="md" 
              px={6}
              onClick={() => router.push('/')}
              _hover={{
                bg: "#5258C5",
                transform: "translateY(-2px)",
                boxShadow: "0px 4px 8px rgba(98, 109, 233, 0.3)"
              }}
              _active={{
                bg: "#4348A2",
                transform: "translateY(0)"
              }}
            >
              반 선택
            </Button>
            
            <InputGroup flex={1}>
              <Input 
                placeholder="학생 이름 입력" 
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                borderRadius="md"
                borderColor="gray.200"
                _hover={{
                  borderColor: "gray.300"
                }}
                _focus={{
                  borderColor: "#626DE9",
                  boxShadow: "0 0 0 1px #626DE9"
                }}
              />
              <InputRightElement width="4.5rem">
                <Button 
                  h="1.75rem" 
                  size="sm" 
                  bg="#626DE9"
                  color="white"
                  onClick={handleAddStudent}
                  _hover={{
                    bg: "#5258C5"
                  }}
                >
                  추가
                </Button>
              </InputRightElement>
            </InputGroup>
            
            <Text fontSize="sm" color="gray.500">
              현재 {students.length}/30명
            </Text>
          </Flex>
        </Box>
        
        {/* 관계 필터 버튼 */}
        <Box bg="white" p={3} borderRadius="lg" boxShadow="0px 2px 8px rgba(0, 0, 0, 0.08)" mb={4}>
          <Flex justify="space-between" wrap="wrap" gap={2}>
            <Button 
              colorScheme={!selectedRelationshipType ? "purple" : "gray"} 
              variant={!selectedRelationshipType ? "solid" : "outline"}
              onClick={() => setSelectedRelationshipType(null)}
              size="sm"
              _hover={{
                transform: "translateY(-2px)",
                boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.1)"
              }}
            >
              전체 보기
            </Button>
            <Button 
              colorScheme={selectedRelationshipType === '친한' ? "purple" : "gray"} 
              variant={selectedRelationshipType === '친한' ? "solid" : "outline"}
              onClick={() => setSelectedRelationshipType('친한')}
              size="sm"
              _hover={{
                transform: "translateY(-2px)",
                boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.1)"
              }}
            >
              친한 관계
            </Button>
            <Button 
              colorScheme={selectedRelationshipType === '보통' ? "purple" : "gray"} 
              variant={selectedRelationshipType === '보통' ? "solid" : "outline"}
              onClick={() => setSelectedRelationshipType('보통')}
              size="sm"
              _hover={{
                transform: "translateY(-2px)",
                boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.1)"
              }}
            >
              보통 관계
            </Button>
            <Button 
              colorScheme={selectedRelationshipType === '안좋은' ? "purple" : "gray"} 
              variant={selectedRelationshipType === '안좋은' ? "solid" : "outline"}
              onClick={() => setSelectedRelationshipType('안좋은')}
              size="sm"
              _hover={{
                transform: "translateY(-2px)",
                boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.1)"
              }}
            >
              안좋은 관계
            </Button>
            <Button 
              colorScheme="purple" 
              variant="outline"
              size="sm"
              _hover={{
                transform: "translateY(-2px)",
                boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.1)"
              }}
            >
              배치 변경
            </Button>
            <Button 
              colorScheme="purple" 
              variant="outline"
              size="sm"
              onClick={() => resetStudents.mutate()}
              isLoading={resetStudents.isPending}
              _hover={{
                transform: "translateY(-2px)",
                boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.1)"
              }}
            >
              학생 초기화
            </Button>
          </Flex>
        </Box>
        
        {/* 그래프 영역 */}
        <Box 
          bg="white" 
          borderRadius="lg" 
          boxShadow="0px 2px 8px rgba(0, 0, 0, 0.08)" 
          mb={4} 
          h="500px" 
          ref={graphContainerRef}
          overflow="hidden"
        >
          {isClient && containerWidth > 0 && (
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              width={containerWidth}
              height={containerHeight}
              nodeLabel="name"
              linkColor={(link: any) => link.color}
              nodeCanvasObject={(node: any, ctx, globalScale) => {
                const label = node.name;
                const fontSize = 16/globalScale;
                ctx.font = `${fontSize}px Sans-Serif`;
                ctx.fillStyle = node.id === selectedStudent ? '#626DE9' : '#333';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, node.x, node.y);
                
                // 원 그리기
                ctx.beginPath();
                ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = node.id === selectedStudent ? '#626DE9' : '#666';
                ctx.fill();
              }}
              onNodeClick={handleNodeClick}
            />
          )}
        </Box>
        
        {/* 주간식 내용 */}
        <Box bg="white" p={4} borderRadius="lg" boxShadow="0px 2px 8px rgba(0, 0, 0, 0.08)" mb={4}>
          <Text fontWeight="bold" mb={3} fontSize="md">주간식 내용</Text>
          <Box>
            {weeklyFormData.length > 0 ? (
              weeklyFormData.map((item, index) => (
                <Box
                  key={index}
                  p={3}
                  borderRadius="md"
                  mb={2}
                  bg={item.question.includes('좋은') ? 'green.50' : 
                     item.question.includes('싫은') ? 'red.50' : 
                     item.question.includes('행복') ? 'blue.50' : 
                     item.question.includes('상처') ? 'purple.50' : 'gray.50'}
                  borderWidth="1px"
                  borderColor={item.question.includes('좋은') ? 'green.100' : 
                              item.question.includes('싫은') ? 'red.100' : 
                              item.question.includes('행복') ? 'blue.100' : 
                              item.question.includes('상처') ? 'purple.100' : 'gray.100'}
                >
                  <Text fontWeight="medium" mb={1} fontSize="sm">{item.question}</Text>
                  <Text fontSize="sm">{item.answer}</Text>
                </Box>
              ))
            ) : (
              <Box p={3} bg="gray.50" borderRadius="md">
                <Text fontSize="sm">학생을 선택해주세요</Text>
              </Box>
            )}
          </Box>
        </Box>
        
        {/* 관계 순위 */}
        <Box mb={4}>
          <Text fontWeight="bold" mb={3} fontSize="md">관계 순위</Text>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <Box bg="white" p={4} borderRadius="lg" boxShadow="0px 2px 8px rgba(0, 0, 0, 0.08)">
              <Text fontWeight="bold" mb={2} fontSize="sm">친한 관계 순위</Text>
              <Text fontSize="xs" color="gray.500">데이터를 불러오는 중...</Text>
            </Box>
            <Box bg="white" p={4} borderRadius="lg" boxShadow="0px 2px 8px rgba(0, 0, 0, 0.08)">
              <Text fontWeight="bold" mb={2} fontSize="sm">보통 관계 순위</Text>
              <Text fontSize="xs" color="gray.500">데이터를 불러오는 중...</Text>
            </Box>
            <Box bg="white" p={4} borderRadius="lg" boxShadow="0px 2px 8px rgba(0, 0, 0, 0.08)">
              <Text fontWeight="bold" mb={2} fontSize="sm">안좋은 관계 순위</Text>
              <Text fontSize="xs" color="gray.500">데이터를 불러오는 중...</Text>
            </Box>
          </SimpleGrid>
        </Box>
      </Container>
    </Box>
  );
} 