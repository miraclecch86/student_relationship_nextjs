import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  fonts: {
    heading: 'var(--font-inter)',
    body: 'var(--font-inter)',
  },
  styles: {
    global: {
      body: {
        bg: 'gray.50',
      },
    },
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'blue',
      },
    },
    Card: {
      baseStyle: {
        p: '6',
        bg: 'white',
        rounded: 'lg',
        boxShadow: 'sm',
        _hover: {
          boxShadow: 'md',
        },
      },
    },
  },
});

export default theme; 