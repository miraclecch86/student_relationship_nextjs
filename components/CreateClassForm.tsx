import React from 'react';
import {
  Box,
  Button,
  FormControl,
  Input,
  useToast,
  HStack,
} from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface CreateClassFormData {
  name: string;
}

export default function CreateClassForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<CreateClassFormData>();
  
  const toast = useToast();
  const queryClient = useQueryClient();

  const createClass = useMutation({
    mutationFn: async (data: CreateClassFormData) => {
      const { error } = await supabase
        .from('classes')
        .insert([data]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({
        title: '학급이 생성되었습니다.',
        status: 'success',
        duration: 3000,
      });
      reset();
    },
    onError: (error) => {
      toast({
        title: '학급 생성에 실패했습니다.',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    },
  });

  const onSubmit = (data: CreateClassFormData) => {
    createClass.mutate(data);
  };

  return (
    <Box
      as="form"
      onSubmit={handleSubmit(onSubmit)}
      bg="white"
      p={4}
      borderRadius="xl"
      boxShadow="0px 2px 8px rgba(0, 0, 0, 0.08)"
      mb={6}
      width="100%"
    >
      <HStack spacing={3}>
        <FormControl>
          <Input
            {...register('name', {
              required: '학급 이름을 입력해주세요.',
              minLength: { value: 2, message: '최소 2글자 이상 입력해주세요.' },
            })}
            placeholder="학급 이름"
            borderRadius="md"
            borderColor="gray.200"
            fontSize="md"
            height="42px"
            _hover={{
              borderColor: "gray.300"
            }}
            _focus={{
              borderColor: "#626DE9",
              boxShadow: "0 0 0 1px #626DE9"
            }}
          />
        </FormControl>

        <Button
          type="submit"
          bg="#626DE9"
          color="white"
          isLoading={createClass.isPending || isSubmitting}
          px={6}
          height="42px"
          borderRadius="md"
          fontWeight="500"
          transition="all 0.2s"
          _hover={{
            bg: "#5258C5",
            transform: "translateY(-2px)",
            boxShadow: "0px 4px 8px rgba(98, 109, 233, 0.3)"
          }}
          _active={{
            bg: "#4348A2",
            transform: "translateY(0)",
            boxShadow: "none"
          }}
        >
          학급 추가
        </Button>
      </HStack>
    </Box>
  );
} 