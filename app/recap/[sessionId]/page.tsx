'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Clock, Mic, ArrowRight, RotateCcw } from 'lucide-react';
import Image from 'next/image';
import NareoAvatar from '@/components/chat/NareoAvatar';
import BadgeDisplay from '@/components/concepts/BadgeDisplay';
import { BadgeType } from '@/types/concept.types';

interface ConceptResult {
  id: string;
  title: string;
  score: number;
  badge: BadgeType | null;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface SessionData {
  id: string;
  chapterId: string;
  totalScore: number;
  conceptsCompleted: number;
  totalConcepts: number;
  timeSpent: number;
  voiceUsed: boolean;
  concepts: ConceptResult[];
  masteryPercentage: number;
}

export default function SessionRecap({ params }: { params: Promise<{ sessionId: string }> }) {
  const router = useRouter();
  const { sessionId } = use(params);
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessionData();
  }, [sessionId]);

  const fetchSessionData = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!response.ok) throw new Error('Failed to fetch session');
      
      const data = await response.json();
      setSession(data);
    } catch (error) {
      console.error('Error fetching session:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWeakConcepts = () => {
    if (!session) return [];
    return session.concepts.filter(c => c.score < 60);
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Image
            src="/chat/mascotte.png"
            alt="Nareo"
            width={400}
            height={400}
            className="mx-auto mb-4 animate-bounce"
          />
          <p className="text-gray-600">Loading session recap...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Session not found</p>
        </div>
      </div>
    );
  }

  const weakConcepts = getWeakConcepts();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header with Nareo */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <NareoAvatar state="success" size="lg" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🎉 Session Complete!
          </h1>
          <p className="text-lg text-gray-600">
            Great work! Here's how you did.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <Trophy className="w-8 h-8 text-orange-500 mx-auto mb-2" />
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {session.totalScore}
            </div>
            <div className="text-sm text-gray-600">Total Score</div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {session.conceptsCompleted}/{session.totalConcepts}
            </div>
            <div className="text-sm text-gray-600">Concepts</div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <Clock className="w-8 h-8 text-orange-500 mx-auto mb-2" />
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {formatTime(session.timeSpent)}
            </div>
            <div className="text-sm text-gray-600">Time Spent</div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {session.masteryPercentage}%
            </div>
            <div className="text-sm text-gray-600">Mastery</div>
          </div>
        </div>

        {/* Voice Usage Badge */}
        {session.voiceUsed && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-8 flex items-center gap-3">
            <Mic className="w-6 h-6 text-orange-500" />
            <div>
              <p className="font-semibold text-gray-900">Voice Learning Active! 🎙️</p>
              <p className="text-sm text-gray-600">
                You used voice input during this session
              </p>
            </div>
          </div>
        )}

        {/* Concepts Results Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Concept Results</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Concept
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Difficulty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Badge
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {session.concepts.map((concept) => (
                  <tr key={concept.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {concept.title}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        concept.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                        concept.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {concept.difficulty === 'easy' ? '📘' : concept.difficulty === 'medium' ? '📗' : '📕'}
                        {' '}{concept.difficulty}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-semibold text-gray-900">
                          {concept.score}/100
                        </div>
                        <div className="ml-2 w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              concept.score >= 80 ? 'bg-green-500' :
                              concept.score >= 60 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${concept.score}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {concept.badge ? (
                        <BadgeDisplay badge={concept.badge} score={concept.score} size="sm" />
                      ) : (
                        <span className="text-sm text-gray-400">No badge</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Suggested Actions */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">What's Next?</h2>
          
          {weakConcepts.length > 0 && (
            <div className="mb-6">
              <div className="flex items-start gap-3 mb-3">
                <RotateCcw className="w-5 h-5 text-orange-500 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Retry Weak Concepts
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    These concepts need more practice:
                  </p>
                  <div className="space-y-2">
                    {weakConcepts.map((concept) => (
                      <button
                        key={concept.id}
                        onClick={() => router.push(`/learn/${concept.id}?retry=true`)}
                        className="block w-full text-left px-4 py-2 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">
                            {concept.title}
                          </span>
                          <span className="text-sm text-orange-600">
                            {concept.score}/100
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => router.push('/')}
              className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
            >
              Upload New Chapter
              <ArrowRight className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 px-6 py-3 bg-white border-2 border-orange-500 text-orange-500 rounded-xl font-semibold hover:bg-orange-50 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Motivational Message from Nareo */}
        <div className="bg-gradient-to-r from-orange-100 to-orange-50 rounded-2xl p-6 border border-orange-200">
          <div className="flex items-start gap-4">
            <NareoAvatar state="happy" size="md" />
            <div>
              <p className="text-gray-900 leading-relaxed">
                {session.masteryPercentage >= 80 ? (
                  <>
                    <strong>Outstanding work! 🌟</strong> You've shown excellent understanding. 
                    Keep this momentum going and you'll master everything in no time!
                  </>
                ) : session.masteryPercentage >= 60 ? (
                  <>
                    <strong>Good progress! 👍</strong> You're on the right track. 
                    Review the concepts that need work and you'll see great improvement!
                  </>
                ) : (
                  <>
                    <strong>Keep going! 💪</strong> Learning takes time and practice. 
                    Don't worry about the score - focus on understanding. You've got this!
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
