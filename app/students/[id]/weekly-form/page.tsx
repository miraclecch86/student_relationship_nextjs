'use client';

import React, { useState } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  useToast,
  FormControl,
  FormLabel,
  Input,
  Textarea,
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
import { DeleteIcon } from '@chakra-ui/icons';
import { supabase } from '@/lib/supabase';
import type { Student } from '@/lib/supabase';

interface WeeklyFormData {
  [key: string]: string;
}

interface NewQuestionData {
  question: string;
  description?: string;
}

export default function WeeklyFormPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const studentId = Number(params.id);
  const [newQuestion, setNewQuestion] = useState<NewQuestionData>({
    question: '',
    description: '',
  });

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*, class_(*)')
        .eq('id', studentId)
        .single();
      
      if (error) throw error;
      return data as Student & { class_: { name: string } };
    },
  });

  const updateWeeklyForm = useMutation({
    mutationFn: async (formData: WeeklyFormData) => {
      const { error } = await supabase
        .from('students')
        .update({ weekly_form_data: formData })
        .eq('id', studentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      toast({
        title: '설문이 업데이트되었습니다.',
        status: 'success',
        duration: 3000,
      });
    },
    onError: (error) => {
      toast({
        title: '설문 업데이트에 실패했습니다.',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    },
  });

  const handleAddQuestion = () => {
    if (!newQuestion.question.trim()) {
      toast({
        title: '질문을 입력해주세요.',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    const currentFormData = student?.weekly_form_data || {};
    const updatedFormData = {
      ...currentFormData,
      [newQuestion.question]: newQuestion.description || '',
    };

    updateWeeklyForm.mutate(updatedFormData);
    setNewQuestion({ question: '', description: '' });
  };

  const handleDeleteQuestion = (questionKey: string) => {
    if (!student?.weekly_form_data) return;

    const updatedFormData = { ...student.weekly_form_data };
    delete updatedFormData[questionKey];
    updateWeeklyForm.mutate(updatedFormData);
  };

  if (isLoading || !student) {
    return (
      <Container maxW="container.xl" py={8}>
        <Text>로딩 중...</Text>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <HStack justify="space-between">
          <Box>
            <Heading size="lg" mb={2}>{student.name}의 주간 설문</Heading>
            <Text color="gray.600">{student.class_.name}</Text>
          </Box>
          <Button
            colorScheme="blue"
            onClick={() => router.push(`/classes/${student.class_id}`)}
          >
            학급으로 돌아가기
          </Button>
        </HStack>

        <Box bg="white" p={6} borderRadius="lg" boxShadow="md">
          <Heading size="md" mb={4}>새 질문 추가</Heading>
          <VStack spacing={4}>
            <FormControl>
              <FormLabel>질문</FormLabel>
              <Input
                value={newQuestion.question}
                onChange={(e) => setNewQuestion(prev => ({
                  ...prev,
                  question: e.target.value,
                }))}
                placeholder="예: 이번 주 기분이 어땠나요?"
              />
            </FormControl>
            <FormControl>
              <FormLabel>설명 (선택사항)</FormLabel>
              <Textarea
                value={newQuestion.description}
                onChange={(e) => setNewQuestion(prev => ({
                  ...prev,
                  description: e.target.value,
                }))}
                placeholder="질문에 대한 부가 설명을 입력하세요."
              />
            </FormControl>
            <Button
              colorScheme="blue"
              onClick={handleAddQuestion}
              isLoading={updateWeeklyForm.isPending}
            >
              질문 추가
            </Button>
          </VStack>
        </Box>

        <Box bg="white" p={6} borderRadius="lg" boxShadow="md">
          <Heading size="md" mb={4}>질문 목록</Heading>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>질문</Th>
                <Th>설명</Th>
                <Th width="100px">작업</Th>
              </Tr>
            </Thead>
            <Tbody>
              {Object.entries(student.weekly_form_data || {}).map(([question, description]) => (
                <Tr key={question}>
                  <Td>{question}</Td>
                  <Td>{description}</Td>
                  <Td>
                    <IconButton
                      aria-label="Delete question"
                      icon={<DeleteIcon />}
                      size="sm"
                      variant="ghost"
                      colorScheme="red"
                      onClick={() => handleDeleteQuestion(question)}
                    />
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