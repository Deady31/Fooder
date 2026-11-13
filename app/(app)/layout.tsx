import { TabBar } from '../../components/nav/TabBar';
import { RitualsRunner } from '../../components/rituals/RitualsRunner';
import { AuthProvider } from '../../components/auth/AuthProvider';
import { TermsGate } from '../../components/legal/TermsGate';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
    <div className='flex flex-col h-full max-w-md mx-auto border-x-[3px] border-plum bg-cream doodle-bg overflow-hidden relative pt-[env(safe-area-inset-top)]'>
      <div className='flex-1 min-h-0 relative'>{children}</div>
      <TabBar />
      <RitualsRunner />
      <TermsGate />
    </div>
    </AuthProvider>
  );
}
