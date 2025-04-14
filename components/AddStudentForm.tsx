import React from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface AddStudentFormData {
  name: string;
}

interface AddStudentFormProps {
  classId: number;
}

export default function AddStudentForm({ classId }: AddStudentFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddStudentFormData>();
  
  const toast = useToast();
  const queryClient = useQueryClient();

  const addStudent = useMutation({
    mutationFn: async (data: AddStudentFormData) => {
      const { error } = await supabase
        .from('students')
        .insert([{ ...data, class_id: classId }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', classId] });
      toast({
        title: '학생이 추가되었습니다.',
        status: 'success',
        duration: 3000,
      });
      reset();
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

  const onSubmit = (data: AddStudentFormData) => {
    addStudent.mutate(data);
  };

  return (
    <Box
      as="form"
      onSubmit={handleSubmit(onSubmit)}
      bg="white"
      p={6}
      borderRadius="lg"
      boxShadow="sm"
      mb={8}
    >
      <VStack spacing={4} align="stretch">
        <FormControl isInvalid={!!errors.name}>
          <FormLabel>학생 이름</FormLabel>
          <Input
            {...register('name', {
              required: '학생 이름을 입력해주세요.',
              minLength: { value: 2, message: '최소 2글자 이상 입력해주세요.' },
            })}
            placeholder="예: 홍길동"
          />
          <FormErrorMessage>
            {errors.name && errors.name.message}
          </FormErrorMessage>
        </FormControl>

        <Button
          type="submit"
          colorScheme="blue"
          isLoading={addStudent.isPending || isSubmitting}
          loadingText="추가 중..."
        >
          학생 추가
        </Button>
      </VStack>
    </Box>
  );
} 