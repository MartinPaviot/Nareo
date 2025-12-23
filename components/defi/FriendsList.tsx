'use client';

import { useState } from 'react';
import {
  Users,
  UserPlus,
  Check,
  X,
  Trash2,
  Copy,
  Loader2,
  AlertCircle,
  Gamepad2,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useFriends } from '@/hooks/defi/useFriends';
import { Friendship, UserProfile } from '@/types/defi';

interface FriendsListProps {
  userId: string;
  userFriendCode: string;
  onChallengeFriend?: (friendId: string) => void;
}

export default function FriendsList({
  userId,
  userFriendCode,
  onChallengeFriend,
}: FriendsListProps) {
  const { isDark } = useTheme();
  const {
    friends,
    pendingRequests,
    loading,
    error,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
  } = useFriends(userId);

  const [showAddModal, setShowAddModal] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(userFriendCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleAddFriend = async () => {
    if (!friendCode.trim()) return;

    setAdding(true);
    setAddError(null);

    const result = await sendFriendRequest(friendCode.trim());

    if (result.success) {
      setFriendCode('');
      setShowAddModal(false);
    } else {
      setAddError(result.error || 'Erreur inconnue');
    }

    setAdding(false);
  };

  const handleAccept = async (friendshipId: string) => {
    try {
      await acceptFriendRequest(friendshipId);
    } catch (err) {
      console.error('Error accepting request:', err);
    }
  };

  const handleReject = async (friendshipId: string) => {
    try {
      await rejectFriendRequest(friendshipId);
    } catch (err) {
      console.error('Error rejecting request:', err);
    }
  };

  const handleRemove = async (friendshipId: string) => {
    if (!confirm('Es-tu sûr de vouloir supprimer cet ami ?')) return;

    try {
      await removeFriend(friendshipId);
    } catch (err) {
      console.error('Error removing friend:', err);
    }
  };

  if (loading) {
    return (
      <div className={`rounded-xl p-6 ${isDark ? 'bg-gray-800' : 'bg-white shadow-md'}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-6 ${isDark ? 'bg-gray-800' : 'bg-white shadow-md'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className={`font-semibold flex items-center gap-2 ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}>
          <Users className="w-5 h-5" />
          Mes amis ({friends.length})
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Ajouter
        </button>
      </div>

      {/* My friend code */}
      <div className={`mb-6 p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
        <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Mon code ami
        </p>
        <div className="flex items-center gap-2">
          <span className={`font-mono font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {userFriendCode}
          </span>
          <button
            onClick={handleCopyCode}
            className={`p-1.5 rounded transition-colors ${
              isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
            }`}
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            )}
          </button>
        </div>
      </div>

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <div className="mb-6">
          <h3 className={`text-sm font-medium mb-3 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}>
            Demandes en attente ({pendingRequests.length})
          </h3>
          <div className="space-y-2">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  isDark ? 'bg-gray-700' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {request.friend_profile.display_name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {request.friend_profile.display_name}
                    </p>
                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Veut devenir ton ami
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAccept(request.id)}
                    className="p-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleReject(request.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      isDark
                        ? 'bg-gray-600 hover:bg-gray-500 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      {friends.length > 0 ? (
        <div className="space-y-2">
          {friends.map((friendship) => (
            <FriendCard
              key={friendship.id}
              friendship={friendship}
              isDark={isDark}
              onChallenge={onChallengeFriend}
              onRemove={handleRemove}
            />
          ))}
        </div>
      ) : (
        <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucun ami pour le moment</p>
          <p className="text-sm mt-1">Ajoutez des amis pour les défier !</p>
        </div>
      )}

      {/* Add friend modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className={`w-full max-w-md rounded-xl p-6 ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Ajouter un ami
            </h3>

            {addError && (
              <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
              }`}>
                <AlertCircle className="w-4 h-4" />
                {addError}
              </div>
            )}

            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Code ami
              </label>
              <input
                type="text"
                value={friendCode}
                onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                placeholder="XXXX-0000"
                className={`w-full px-4 py-3 rounded-lg font-mono text-lg tracking-wider uppercase ${
                  isDark
                    ? 'bg-gray-700 text-white placeholder-gray-500 border border-gray-600'
                    : 'bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setFriendCode('');
                  setAddError(null);
                }}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                Annuler
              </button>
              <button
                onClick={handleAddFriend}
                disabled={adding || !friendCode.trim()}
                className="flex-1 py-3 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {adding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Ajouter
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FriendCard({
  friendship,
  isDark,
  onChallenge,
  onRemove,
}: {
  friendship: Friendship & { friend_profile: UserProfile };
  isDark: boolean;
  onChallenge?: (friendId: string) => void;
  onRemove: (friendshipId: string) => void;
}) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg ${
      isDark ? 'bg-gray-700' : 'bg-gray-50'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
        }`}>
          {friendship.friend_profile.display_name[0].toUpperCase()}
        </div>
        <div>
          <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {friendship.friend_profile.display_name}
          </p>
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {friendship.friend_profile.total_points} points
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onChallenge && (
          <button
            onClick={() => onChallenge(friendship.friend_profile.id)}
            className="p-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
            title="Défier"
          >
            <Gamepad2 className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onRemove(friendship.id)}
          className={`p-2 rounded-lg transition-colors ${
            isDark
              ? 'bg-gray-600 hover:bg-red-600 text-gray-400 hover:text-white'
              : 'bg-gray-200 hover:bg-red-100 text-gray-500 hover:text-red-600'
          }`}
          title="Supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
