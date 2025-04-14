'use client';

import React from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
} from '@chakra-ui/react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DeleteIcon, EditIcon } from '@chakra-ui/icons';
import { supabase } from '@/lib/supabase';
import type { Class, Student } from '@/lib/supabase';
import AddStudentForm from '@/components/AddStudentForm';

export default function ClassPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const classId = Number(params.id);

  const { data: class_, isLoading: isLoadingClass } = useQuery({
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

  const { data: students, isLoading: isLoadingStudents } = useQuery({
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

  const deleteStudent = useMutation({
    mutationFn: async (studentId: number) => {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', classId] });
      toast({
        title: '학생이 삭제되었습니다.',
        status: 'success',
        duration: 3000,
      });
    },
    onError: (error) => {
      toast({
        title: '학생 삭제에 실패했습니다.',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    },
  });

  const handleDeleteStudent = (studentId: number) => {
    if (window.confirm('정말로 이 학생을 삭제하시겠습니까?')) {
      deleteStudent.mutate(studentId);
    }
  };

  if (isLoadingClass || isLoadingStudents) {
    return (
      <Container maxW="container.xl" py={8}>
        <Text>로딩 중...</Text>
      </Container>
    );
  }

  if (!class_) {
    return (
      <Container maxW="container.xl" py={8}>
        <Text>학급을 찾을 수 없습니다.</Text>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <HStack justify="space-between">
          <Box>
            <Heading size="lg" mb={2}>{class_.name}</Heading>
            {class_.description && (
              <Text color="gray.600">{class_.description}</Text>
            )}
          </Box>
          <Button
            colorScheme="blue"
            onClick={() => router.push(`/classes/${classId}/relationships`)}
          >
            관계도 보기
          </Button>
        </HStack>

        <Box>
          <Heading size="md" mb={4}>학생 추가</Heading>
          <AddStudentForm classId={classId} />
        </Box>

        <Box>
          <Heading size="md" mb={4}>학생 목록</Heading>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>이름</Th>
                <Th>주간 설문</Th>
                <Th width="100px">작업</Th>
              </Tr>
            </Thead>
            <Tbody>
              {students?.map((student) => (
                <Tr key={student.id}>
                  <Td>{student.name}</Td>
                  <Td>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/students/${student.id}/weekly-form`)}
                    >
                      설문 관리
                    </Button>
                  </Td>
                  <Td>
                    <HStack spacing={2}>
                      <IconButton
                        aria-label="Edit student"
                        icon={<EditIcon />}
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/students/${student.id}/edit`)}
                      />
                      <IconButton
                        aria-label="Delete student"
                        icon={<DeleteIcon />}
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => handleDeleteStudent(student.id)}
                        isLoading={deleteStudent.isPending}
                      />
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </VStack>
    </Container>
  );
} 