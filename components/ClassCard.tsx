import React, { useState } from 'react';
import {
  Box,
  Text,
  Button,
  Flex,
  Input,
  useToast,
  IconButton,
} from '@chakra-ui/react';
import { CheckIcon, CloseIcon, EditIcon } from '@chakra-ui/icons';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Class } from '@/lib/supabase';

interface ClassCardProps {
  class_: Class;
}

export default function ClassCard({ class_ }: ClassCardProps) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(class_.name);

  // 학생 수 조회
  const { data: studentCount = 0 } = useQuery({
    queryKey: ['studentCount', class_.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', class_.id);
      
      if (error) throw error;
      return count || 0;
    },
  });

  // 주간식 수 조회 (임시로 설정, 실제로는 해당 학급의 주간식 데이터를 조회해야 함)
  const { data: weeklyMealCount = 0 } = useQuery({
    queryKey: ['weeklyMealCount', class_.id],
    queryFn: async () => {
      // 여기서는 임시로 0 또는 1을 반환하도록 함
      // 실제로는 주간식 관련 테이블을 조회해야 함
      const { data, error } = await supabase
        .from('students')
        .select('weekly_form_data')
        .eq('class_id', class_.id)
        .not('weekly_form_data', 'is', null);
      
      if (error) throw error;
      return data.length;
    },
  });

  const updateClass = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from('classes')
        .update({ name })
        .eq('id', class_.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({
        title: '학급명이 수정되었습니다.',
        status: 'success',
        duration: 3000,
      });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: '학급명 수정에 실패했습니다.',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    },
  });

  const deleteClass = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', class_.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({
        title: '학급이 삭제되었습니다.',
        status: 'success',
        duration: 3000,
      });
    },
    onError: (error) => {
      toast({
        title: '학급 삭제에 실패했습니다.',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    },
  });

  const handleSaveEdit = () => {
    if (!editName.trim()) {
      toast({
        title: '학급명을 입력해주세요.',
        status: 'warning',
        duration: 3000,
      });
      return;
    }
    updateClass.mutate(editName);
  };

  const handleCancelEdit = () => {
    setEditName(class_.name);
    setIsEditing(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // 이벤트 버블링 방지
    if (window.confirm('정말로 이 학급을 삭제하시겠습니까?')) {
      deleteClass.mutate();
    }
  };

  // 학급 카드 클릭 시 관계도 페이지로 이동
  const handleCardClick = (e: React.MouseEvent) => {
    // 편집 모드일 때 카드 클릭해도 이동하지 않음
    if (isEditing) return;
    router.push(`/classes/${class_.id}/relationships`);
  };

  return (
    <Box
      bg="white"
      boxShadow="0px 2px 6px rgba(0, 0, 0, 0.06)"
      borderRadius="lg"
      overflow="hidden"
      cursor={isEditing ? "default" : "pointer"}
      onClick={handleCardClick}
      transition="all 0.2s"
      _hover={{
        boxShadow: "0px 3px 10px rgba(0, 0, 0, 0.1)",
        transform: isEditing ? "none" : "translateY(-2px)"
      }}
      width="280px"
    >
      {/* 헤더 부분 */}
      <Box
        bg="#626DE9"
        color="white"
        py={1.5}
        px={3}
        position="relative"
      >
        {isEditing ? (
          <Flex align="center">
            <Input 
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              color="white"
              size="sm"
              variant="flushed"
              placeholder="학급명 입력"
              _placeholder={{ color: "whiteAlpha.700" }}
              autoFocus
              mr={2}
            />
            <IconButton
              aria-label="Save"
              icon={<CheckIcon />}
              size="xs"
              colorScheme="whiteAlpha"
              variant="ghost"
              onClick={handleSaveEdit}
              mr={1}
            />
            <IconButton
              aria-label="Cancel"
              icon={<CloseIcon />}
              size="xs"
              colorScheme="whiteAlpha"
              variant="ghost"
              onClick={handleCancelEdit}
            />
          </Flex>
        ) : (
          <Text fontWeight="600" fontSize="14px">{class_.name}</Text>
        )}
      </Box>
      
      {/* 통계 부분 */}
      <Flex bg="#F7F8FB" py={1.5} px={3}>
        <Flex direction="column" align="center" justify="center" flex="1">
          <Text color="gray.500" fontSize="11px" mb="1px">전체 학생</Text>
          <Text color="#626DE9" fontSize="20px" fontWeight="bold" lineHeight="1.2">
            {studentCount}
          </Text>
        </Flex>
        <Flex direction="column" align="center" justify="center" flex="1">
          <Text color="gray.500" fontSize="11px" mb="1px">주간식</Text>
          <Flex align="baseline">
            <Text color="#626DE9" fontSize="20px" fontWeight="bold" lineHeight="1.2">
              {weeklyMealCount}
            </Text>
            <Text color="#626DE9" fontSize="13px" fontWeight="medium" ml="2px">
              개
            </Text>
          </Flex>
        </Flex>
      </Flex>
      
      {/* 버튼 부분 */}
      <Flex>
        <Button
          flex={1}
          variant="ghost"
          bg="#EEF0FF"
          color="#626DE9"
          py={1}
          height="32px"
          borderRadius="0"
          fontWeight="400"
          fontSize="12px"
          _hover={{
            bg: "#DDE0FF"
          }}
          _active={{
            bg: "#CCD0FF"
          }}
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          isDisabled={isEditing}
        >
          수정
        </Button>
        <Button
          flex={1}
          variant="ghost"
          bg="#FFF0F0"
          color="#FF5A5A"
          py={1}
          height="32px"
          borderRadius="0"
          fontWeight="400"
          fontSize="12px"
          _hover={{
            bg: "#FFE0E0"
          }}
          _active={{
            bg: "#FFCECE"
          }}
          onClick={handleDelete}
        >
          삭제
        </Button>
      </Flex>
    </Box>
  );
} 