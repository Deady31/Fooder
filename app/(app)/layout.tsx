import { TabBar } from '../../components/nav/TabBar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex flex-col h-[100dvh] max-w-md mx-auto border-x-[3px] border-plum bg-cream overflow-hidden relative'>
      <div className='flex-1 min-h-0 relative'>{children}</div>
      <TabBar />
    </div>
  );
}
