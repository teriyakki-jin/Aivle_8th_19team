import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MessageSquare, Eye, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Post {
    id: number;
    title: string;
    content: string;
    author_name: string;
    created_at: string;
}

export const BoardListPage = () => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers: HeadersInit = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch('/api/v1/board', { headers });
            if (response.ok) {
                const data = await response.json();
                setPosts(data);
            }
        } catch (error) {
            console.error('Failed to fetch posts:', error);
        } finally {
            setLoading(false);
        }
    };

    const stripHtml = (html: string) => {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">공지사항 및 게시판</h1>
                    <p className="text-gray-600 mt-1">사내 소식과 의견을 공유하세요</p>
                </div>
                <Link to="/board/write">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all px-2 py-3 rounded-lg flex items-center justify-center gap-4">
                        <Plus className="h-3 w-6" />
                        <span className="h-3 w-1 font-bold text-base">새글작성</span>
                    </Button>
                </Link>
            </div>

            {loading ? (
                <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-500">게시글을 불러오는 중...</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {posts.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-200">
                            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500 text-lg">게시글이 없습니다.</p>
                            <p className="text-gray-400 text-sm mt-2">첫 번째 글을 작성해보세요!</p>
                        </div>
                    ) : (
                        posts.map((post) => (
                            <div 
                                key={post.id} 
                                className="bg-white rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-all overflow-hidden"
                            >
                                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-transparent">
                                    <Link to={`/board/${post.id}`}>
                                        <h3 className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-3">
                                            <MessageSquare className="w-6 h-6 text-blue-600" />
                                            {post.title}
                                        </h3>
                                    </Link>
                                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                                        <span className="flex items-center gap-1">
                                            <User className="w-4 h-4" />
                                            {post.author_name}
                                        </span>
                                        <span className="text-gray-400">•</span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-4 h-4" />
                                            {new Date(post.created_at).toLocaleDateString('ko-KR', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-6">
                                    {expandedId === post.id ? (
                                        <div>
                                            <div 
                                                className="prose max-w-none mb-4"
                                                dangerouslySetInnerHTML={{ __html: post.content }}
                                            />
                                            <button
                                                onClick={() => setExpandedId(null)}
                                                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 text-sm"
                                            >
                                                <Eye className="w-4 h-4" />
                                                접기
                                            </button>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-gray-600 line-clamp-3 mb-4">
                                                {stripHtml(post.content)}
                                            </p>
                                            <div className="flex justify-between items-center">
                                                <button
                                                    onClick={() => setExpandedId(post.id)}
                                                    className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 text-sm"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    더보기
                                                </button>
                                                <Link 
                                                    to={`/board/${post.id}`}
                                                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                                                >
                                                    자세히 보기 →
                                                </Link>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
