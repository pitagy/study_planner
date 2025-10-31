'use client';
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';

interface Memo {
  id: number;
  user_id: string;
  date: string;
  content: string;
  author_name: string;
  parent_id?: number | null;
  created_at?: string;
  role?: string;
}

export default function TodayMemoSection({ supabase, viewerId, selectedDate }: any) {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMemo, setNewMemo] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string } | null>(
    null
  );

  /** 🔹 현재 로그인 사용자 불러오기 */
  const loadCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, student_name, role')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setCurrentUser({
        id: data.id,
        name: data.student_name || '익명',
        role: data.role || 'student',
      });
    }
  };

  /** 🔹 메모 불러오기 (UTC 시차 제거: 문자열 기반 비교) */
  const loadMemos = async () => {
    setLoading(true);

    // selectedDate를 YYYY-MM-DD 형태로 보정 (UTC 시차 문제 방지)
    const dateString = dayjs(selectedDate).format('YYYY-MM-DD');

    // date 컬럼이 문자열(TEXT or DATE)이면 그대로 eq 비교
    // timestamp 컬럼이면 PostgREST RPC를 이용해 to_char 비교
    const { data, error } = await supabase
      .from('dashboard_comments')
      .select('id, user_id, date, content, author_name, parent_id, created_at, role')
      .eq('user_id', viewerId)
      .eq('date', dateString) // 🔹 핵심: 문자열 기반으로 정확히 같은 날짜만 불러옴
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMemos(data);
    } else {
      console.error('메모 불러오기 실패:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (viewerId && selectedDate) {
      loadCurrentUser();
      loadMemos();
    }
  }, [viewerId, selectedDate]);

  /** 🔹 메모 저장 */
  const handleSubmit = async () => {
    if (!newMemo.trim()) return alert('메모를 입력하세요.');
    if (!currentUser) return alert('로그인 정보가 없습니다.');

    const dateString = dayjs(selectedDate).format('YYYY-MM-DD');

    const insertData = {
      user_id: viewerId,
      date: dateString,
      content: newMemo.trim(),
      author_name: currentUser.name,
      role: currentUser.role,
      parent_id: replyTo,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('dashboard_comments').insert([insertData]);
    if (error) {
      console.error(error);
      alert('메모 저장 중 오류가 발생했습니다.');
      return;
    }

    setNewMemo('');
    setReplyTo(null);
    loadMemos();
  };

  /** 🔹 답글 작성 */
  const handleReply = (parentId: number) => {
    setReplyTo(parentId);
  };

  /** 🔹 역할별 배경색 */
  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'bg-yellow-50 border-yellow-200';
      case 'teacher':
        return 'bg-teal-50 border-teal-200';
      default:
        return 'bg-sky-50 border-sky-200';
    }
  };

  /** 🔹 댓글 렌더링 */
  const renderReplies = (parentId: number, level: number) => {
    const replies = memos.filter((m) => m.parent_id === parentId);
    if (replies.length === 0) return null;

    return replies.map((reply) => (
      <div
        key={reply.id}
        className={`mt-2 ml-${Math.min(level * 6, 24)} pl-3 border-l-2 border-gray-300 rounded-md ${getRoleColor(
          reply.role
        )}`}
      >
        <p className="text-sm text-gray-700 flex items-start">
          <span className="mr-1 text-gray-400 select-none">ㄴ</span>
          <span>
            <strong className="text-gray-900">
              {reply.author_name} ({reply.role})
            </strong>
            : {reply.content}
          </span>
        </p>
        <button
          onClick={() => handleReply(reply.id)}
          className="text-xs text-blue-500 hover:underline mt-1 ml-5"
        >
          💬 답글
        </button>
        {renderReplies(reply.id, level + 1)}
      </div>
    ));
  };

  const rootMemos = memos.filter((m) => !m.parent_id);

  return (
    <section className="bg-white rounded-xl p-4 border mt-4">
      <h2 className="font-semibold mb-3">
        🗒️ {dayjs(selectedDate).format('M월 D일')}의 메모
      </h2>

      {/* 입력창 */}
      <div className="mb-4">
        {replyTo && (
          <p className="text-xs text-gray-500 mb-1">
            💬 <strong>{replyTo}</strong>번 메모에 답글 작성 중...
            <button
              onClick={() => setReplyTo(null)}
              className="ml-2 text-red-400 hover:underline text-xs"
            >
              취소
            </button>
          </p>
        )}
        <textarea
          className="w-full p-2 border rounded-md text-sm focus:ring focus:ring-blue-200"
          rows={3}
          placeholder="메모를 입력하세요..."
          value={newMemo}
          onChange={(e) => setNewMemo(e.target.value)}
        />
        <button
          onClick={handleSubmit}
          className="mt-2 px-4 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          {replyTo ? '답글 등록' : '메모 등록'}
        </button>
      </div>

      {/* 메모 리스트 */}
      {loading ? (
        <p className="text-gray-400 text-sm">메모를 불러오는 중...</p>
      ) : memos.length === 0 ? (
        <p className="text-gray-500 text-sm">오늘의 메모가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {rootMemos.map((memo) => (
            <div
              key={memo.id}
              className={`p-3 rounded-md border shadow-sm ${getRoleColor(memo.role)}`}
            >
              <p className="text-sm text-gray-800">
                <strong className="text-gray-900">
                  {memo.author_name} ({memo.role})
                </strong>
                : {memo.content}
              </p>
              <button
                onClick={() => handleReply(memo.id)}
                className="text-xs text-blue-500 hover:underline mt-1"
              >
                💬 답글
              </button>
              {renderReplies(memo.id, 1)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}