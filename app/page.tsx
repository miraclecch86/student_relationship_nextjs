'use client';

import React from 'react';
import { Box, Container, Heading, SimpleGrid, Center, Flex } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import ClassCard from '@/components/ClassCard';
import CreateClassForm from '@/components/CreateClassForm';

export default function Home() {
  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <Box bg="gray.50" minH="100vh">
      <Container maxW="container.xl" py={6}>
        <Center>
          <Heading size="lg" mb={6} mt={4} color="#333">
            학급 관리
          </Heading>
        </Center>
        
        <CreateClassForm />
        
        {isLoading ? (
          <Box textAlign="center" py={8} color="gray.500">
            로딩 중...
          </Box>
        ) : (
          <Flex 
            justify="flex-start" 
            wrap="wrap" 
            gap={4} 
            mt={6}
            sx={{
              '@media (max-width: 768px)': {
                justifyContent: 'center',
              }
            }}
          >
            {classes?.map((class_) => (
              <ClassCard key={class_.id} class_={class_} />
            ))}
          </Flex>
        )}
      </Container>
    </Box>
  );
} 