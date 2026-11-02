import View from './view';
import { queryParams } from '@/lib/search-params';

export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
    const query = queryParams(searchParams);
    return <View key={JSON.stringify(query)} searchParams={query} />;
}
