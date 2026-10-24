declare module 'react-test-renderer' {
  export interface ReactTestInstance {
    props: Record<string, any>;
    findAllByType(type: any): ReactTestInstance[];
  }
  export interface ReactTestRenderer {
    root: ReactTestInstance;
    unmount(): void;
    update(element: import('react').ReactElement): void;
    toJSON(): any;
  }
  export function create(element: any): ReactTestRenderer;
  export function act(callback: () => void | Promise<void>): Promise<void>;
}
