import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { THEME } from '../theme';
import {
  api,
  FriendItemDto,
  FriendRequestItemDto,
  PublicProfileDto,
} from '../network/apiClient';
import { useSession } from '../network/session';
import { getCurrentUser } from '../network/auth';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { KeyboardShift } from '../components/KeyboardShift';
import { nameInitial, resolveName } from '../displayName';

interface FriendsScreenProps {
  onOpenChallengeSetup: (friend: { id: string; username: string }) => void;
  onOpenPlayerProfile: (player: { userId: string; username: string }) => void;
  onRequestCountChange?: (count: number) => void;
}

// Web only: kill the black focus outline on text inputs (not in RN types).
const NO_OUTLINE: any = Platform.OS === 'web' ? { outlineStyle: 'none' } : {};

export const FriendsScreen: React.FC<FriendsScreenProps> = ({
  onOpenChallengeSetup,
  onOpenPlayerProfile,
  onRequestCountChange,
}) => {
  const [friends, setFriends] = useState<FriendItemDto[]>([]);
  const [requests, setRequests] = useState<FriendRequestItemDto[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalQuery, setModalQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicProfileDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<FriendItemDto | null>(null);
  const [removing, setRemoving] = useState(false);
  const [ownUsername, setOwnUsername] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [copiedTick, setCopiedTick] = useState(false);
  const [addFeedback, setAddFeedback] = useState<string | null>(null);
  const { identity } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSocialData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [friendsList, requestsList] = await Promise.all([
        api.getFriends().catch(() => []),
        api.getFriendRequests().catch(() => []),
      ]);
      setFriends(friendsList);
      setRequests(requestsList);
      if (onRequestCountChange) {
        onRequestCountChange(requestsList.length);
      }
    } catch {
      if (!silent) setError('Unable to load friends.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [onRequestCountChange]);

  useEffect(() => {
    loadSocialData();
  }, [loadSocialData]);

  // Live refresh: incoming requests and presence land within seconds,
  // no browser refresh needed. Silent — no spinner flashes.
  useEffect(() => {
    const interval = setInterval(() => {
      loadSocialData(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [loadSocialData]);

  const handleSearchChange = (text: string) => {
    setModalQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (text.trim().length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await api.searchUsers(text.trim());
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleRespondRequest = async (requestId: string, accept: boolean) => {
    try {
      await api.respondFriendRequest(requestId, accept);
      const updated = requests.filter((r) => r.id !== requestId);
      setRequests(updated);
      if (onRequestCountChange) onRequestCountChange(updated.length);
      if (accept) {
        const newFriends = await api.getFriends().catch(() => []);
        setFriends(newFriends);
      }
    } catch {
      // ignore
    }
  };

  const handleRemoveFriend = async () => {
    if (!removeTarget || removing) return;
    setRemoving(true);
    try {
      await api.removeFriend(removeTarget.id);
      setFriends((prev) => prev.filter((f) => f.id !== removeTarget.id));
      setRemoveTarget(null);
    } catch {
      // keep the menu open on failure
    } finally {
      setRemoving(false);
    }
  };

  const openAddModal = () => {
    setShowAddModal(true);
    setAddFeedback(null);
    setModalQuery('');
    setSearchResults([]);
    api
      .getOutgoingRequestUserIds()
      .then((ids) =>
        setSentIds((prev) => Array.from(new Set([...prev, ...ids])))
      )
      .catch(() => {});
    api
      .getMe()
      .then((me) => setOwnUsername(me.username))
      .catch(() => setOwnUsername(identity.displayName));
  };

  const copyOwnId = async () => {
    if (!ownUsername) return;
    try {
      await Clipboard.setStringAsync(ownUsername);
    } catch {
      // ignore
    }
    setCopiedTick(true);
    setTimeout(() => setCopiedTick(false), 1500);
  };

  const handleSendRequestToUser = async (target: PublicProfileDto) => {
    try {
      await api.sendFriendRequest({ toUserId: target.id, toUsername: target.username });
      setSentIds((prev) => (prev.includes(target.id) ? prev : [...prev, target.id]));
    } catch (e: any) {
      setAddFeedback(e?.message ?? 'Could not send request.');
    }
  };

  const handleAddByName = async () => {
    const name = modalQuery.trim();
    if (name.length < 3) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setIsSearching(true);
    setAddFeedback(null);
    try {
      const results = await api.searchUsers(name);
      setSearchResults(results);
      if (results.length === 0) setAddFeedback('No player found with that name.');
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Filter friends based on search query in the main view
  const filteredFriends = friends.filter((f) =>
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const onlineFriends = filteredFriends.filter((f) => f.status === 'ONLINE' || f.status === 'PLAYING');
  const offlineFriends = filteredFriends.filter((f) => f.status !== 'ONLINE' && f.status !== 'PLAYING');

  const renderFriendCard = (friend: FriendItemDto) => {
    const isOnline = friend.status === 'ONLINE' || friend.status === 'PLAYING';
    const initial = nameInitial(friend);

    return (
      <TouchableOpacity
        key={friend.id}
        style={[styles.friendCard, !isOnline && styles.friendCardOffline]}
        activeOpacity={0.75}
        onPress={() => onOpenPlayerProfile({ userId: friend.id, username: friend.username })}
      >
        <View style={styles.friendLeft}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatarBox, isOnline ? styles.avatarBoxOnline : styles.avatarBoxOffline, !isOnline && styles.avatarBoxCompact]}>
              <Text style={[styles.avatarInitial, !isOnline && styles.avatarInitialCompact, { color: isOnline ? THEME.colors.primary : THEME.colors.textSecondary }]}>
                {initial}
              </Text>
            </View>
            {isOnline && (
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: THEME.colors.tertiary },
                ]}
              />
            )}
          </View>

          <View style={styles.friendMeta}>
            <View style={styles.nameRow}>
              <Text style={[styles.friendName, !isOnline && styles.friendNameCompact]} numberOfLines={1}>
                {resolveName(friend)}
              </Text>
              <Text style={[styles.friendRating, !isOnline && styles.friendRatingCompact]}>{friend.rating}</Text>
            </View>
            <Text style={styles.friendHandle} numberOfLines={1}>
              @{friend.username} ·{' '}
              <Text style={[styles.statusText, { color: isOnline ? THEME.colors.tertiary : THEME.colors.textMuted }]}>
                {friend.status === 'PLAYING' ? 'In a match' : isOnline ? 'Online' : 'Offline'}
              </Text>
            </Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          {isOnline && (
            <TouchableOpacity
              style={styles.playButton}
              activeOpacity={0.8}
              onPress={() => onOpenChallengeSetup({ id: friend.id, username: friend.username })}
            >
              <MaterialCommunityIcons name="sword-cross" size={14} color="#FFFFFF" />
              <Text style={styles.playButtonText}>Challenge</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <TouchableOpacity
          style={styles.addFriendBtn}
          activeOpacity={0.7}
          onPress={() => openAddModal()}
          accessibilityLabel="Add Friend"
        >
          <Feather name="user-plus" size={18} color={THEME.colors.onSurface} />
        </TouchableOpacity>
      </View>

      {/* Clean Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={THEME.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
            placeholderTextColor={THEME.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={16} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Content List */}
      {loading ? (
        <LoadingState message="Loading friends…" />
      ) : error ? (
        <ErrorState message={error} onRetry={loadSocialData} />
      ) : (
        <FlatList
          data={[1]}
          keyExtractor={() => 'friends_content'}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={() => (
            <View style={styles.sectionsContainer}>
              {/* Friend Requests Section */}
              {requests.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>
                      FRIEND REQUESTS · {requests.length}
                    </Text>
                  </View>

                  <View style={styles.requestsCardList}>
                    {requests.map((req) => (
                      <View key={req.id} style={styles.requestCard}>
                        <View style={styles.requestLeft}>
                          <View style={styles.requestAvatar}>
                            <Text style={styles.requestAvatarText}>
                              {req.fromUsername.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.requestMeta}>
                            <Text style={styles.requestUsername}>{req.fromUsername}</Text>
                            <Text style={styles.requestSub}>Incoming friend request</Text>
                          </View>
                        </View>

                        <View style={styles.requestActionButtons}>
                          <TouchableOpacity
                            style={styles.acceptBtn}
                            activeOpacity={0.8}
                            onPress={() => handleRespondRequest(req.id, true)}
                            accessibilityLabel="Accept friend request"
                          >
                            <Feather name="check" size={16} color="#FFFFFF" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.declineBtn}
                            activeOpacity={0.8}
                            onPress={() => handleRespondRequest(req.id, false)}
                            accessibilityLabel="Decline friend request"
                          >
                            <Feather name="x" size={16} color={THEME.colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Online Friends Section */}
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>ONLINE · {onlineFriends.length}</Text>
                </View>

                {onlineFriends.length > 0 ? (
                  <View style={styles.cardGroup}>
                    {onlineFriends.map(renderFriendCard)}
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No friends currently online</Text>
                  </View>
                )}
              </View>

              {/* Offline Friends Section */}
              {offlineFriends.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>OFFLINE · {offlineFriends.length}</Text>
                  </View>
                  <View style={styles.cardGroup}>
                    {offlineFriends.map(renderFriendCard)}
                  </View>
                </View>
              )}

              {friends.length === 0 && requests.length === 0 && (
                <View style={styles.zeroFriendsBox}>
                  <Feather name="users" size={40} color={THEME.colors.textMuted} />
                  <Text style={styles.zeroFriendsTitle}>No friends yet</Text>
                  <Text style={styles.zeroFriendsSub}>
                    Search for players and challenge them to tactical matches.
                  </Text>
                  <TouchableOpacity
                    style={styles.zeroAddBtn}
                    activeOpacity={0.8}
                    onPress={() => openAddModal()}
                  >
                    <Text style={styles.zeroAddBtnText}>Find Friends</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* Remove Friend Confirm */}
      <Modal visible={!!removeTarget} transparent animationType="fade">
        <SafeAreaView style={styles.modalOverlay} edges={['top', 'bottom']}>
          <View style={styles.modalCard}>
            <Text style={styles.removeTitle}>
              Remove {removeTarget?.username ?? 'friend'}?
            </Text>
            <Text style={styles.removeDesc}>
              You will no longer see each other in your friends lists.
            </Text>
            <View style={styles.removeActions}>
              <TouchableOpacity
                style={[styles.removeConfirm, removing && styles.disabledAction]}
                disabled={removing}
                onPress={() => void handleRemoveFriend()}
              >
                <Text style={styles.removeConfirmText}>
                  {removing ? 'Removing…' : 'Remove friend'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeCancel}
                onPress={() => setRemoveTarget(null)}
              >
                <Text style={styles.removeCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Add Friend Bottom Sheet */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <KeyboardShift>
        <SafeAreaView style={styles.sheetOverlay} edges={['top', 'bottom']}>
          <View style={styles.sheetCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Friend</Text>
              <TouchableOpacity
                style={styles.sheetClose}
                onPress={() => {
                  setShowAddModal(false);
                  setModalQuery('');
                  setSearchResults([]);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={20} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.sheetInputRow}>
              <View style={styles.modalSearchBox}>
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Username or ID"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={modalQuery}
                  onChangeText={handleSearchChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
              </View>
              <TouchableOpacity
                style={[styles.sheetAddBtn, modalQuery.trim().length < 3 && styles.sheetAddBtnDisabled]}
                disabled={modalQuery.trim().length < 3}
                onPress={() => void handleAddByName()}
                accessibilityLabel="Search"
              >
                <Feather name="search" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {!!addFeedback && <Text style={styles.addFeedback}>{addFeedback}</Text>}

            <ScrollView
              style={styles.modalResultsScroll}
              contentContainerStyle={styles.modalResultsContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {isSearching ? (
                <Text style={styles.searchHint}>Searching players...</Text>
              ) : modalQuery.trim().length > 0 && modalQuery.trim().length < 3 ? (
                <Text style={styles.searchHint}>Type at least 3 letters to search.</Text>
              ) : searchResults.length > 0 ? (
                searchResults.map((user) => {
                  const alreadyFriend = friends.some((f) => f.id === user.id);
                  const justSent = sentIds.includes(user.id);
                  const isSelf = user.id === getCurrentUser().userId;
                  return (
                    <View key={user.id} style={styles.searchResultItem}>
                      <View style={styles.searchResultLeft}>
                        <View style={styles.searchAvatar}>
                          <Text style={styles.searchAvatarText}>
                            {nameInitial(user)}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.searchUsername}>{resolveName(user)}</Text>
                          <Text style={styles.searchHandle}>@{user.username}</Text>
                        </View>
                      </View>

                      {alreadyFriend || justSent || isSelf ? (
                        <View style={styles.sentTag}>
                          <Feather name="check" size={12} color={THEME.colors.textMuted} />
                          <Text style={styles.sentTagText}>
                            {alreadyFriend ? 'Friends' : isSelf ? 'You' : 'Sent'}
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.sendRequestBtn}
                          onPress={() => handleSendRequestToUser(user)}
                          accessibilityLabel={`Add ${user.username}`}
                        >
                          <Feather name="user-plus" size={14} color={THEME.colors.textPrimary} />
                          <Text style={styles.sendRequestBtnText}>Add</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.searchHint}>Type a player's username to send a request.</Text>
              )}
            </ScrollView>

            {/* Your ID */}
            <View style={styles.ownIdRow}>
              <View>
                <Text style={styles.ownIdLabel}>Your ID</Text>
                <Text style={styles.ownIdValue}>{ownUsername?.toUpperCase() ?? '…'}</Text>
              </View>
              <TouchableOpacity
                style={styles.ownIdCopy}
                onPress={() => void copyOwnId()}
              >
                <Feather name="copy" size={16} color={THEME.colors.primary} />
                <Text style={styles.ownIdCopyText}>{copiedTick ? 'Copied' : 'Copy'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
        </KeyboardShift>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceContainer,
  },
  title: {
    fontFamily: THEME.fonts.bold,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  addFriendBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: THEME.colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  searchBox: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    ...THEME.shadows.card,
  },
  searchInput: {
    fontFamily: THEME.fonts.medium,
    flex: 1,
    fontSize: 14,
    color: THEME.colors.onSurface,
    paddingVertical: 0,
    ...NO_OUTLINE,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  sectionsContainer: {
    gap: 16,
  },
  section: {
    gap: 8,
  },
  sectionTitleRow: {
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  requestsCardList: {
    gap: 8,
  },
  requestCard: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...THEME.shadows.card,
  },
  requestLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  requestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: THEME.colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestAvatarText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  requestMeta: {
    gap: 2,
    flex: 1,
  },
  requestUsername: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.onSurface,
  },
  requestSub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 11,
    color: THEME.colors.onSurfaceVariant,
  },
  requestActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  acceptBtn: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: THEME.colors.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: THEME.colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardGroup: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    overflow: 'hidden',
    ...THEME.shadows.card,
  },
  friendCard: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceContainerLow,
  },
  friendCardOffline: {
    opacity: 0.8,
    paddingVertical: 10,
  },
  friendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBoxOnline: {
    backgroundColor: THEME.colors.primaryLight,
  },
  avatarBoxOffline: {
    backgroundColor: THEME.colors.surfaceContainerLow,
  },
  avatarInitial: {
    fontFamily: THEME.fonts.bold,
    fontSize: 15,
    fontWeight: '700',
  },
  avatarBoxCompact: {
    width: 36,
    height: 36,
  },
  avatarInitialCompact: {
    fontSize: 12,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  friendMeta: {
    gap: 2,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  friendName: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.onSurface,
  },
  friendRating: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  friendRatingCompact: {
    fontSize: 11,
    fontWeight: '400',
  },
  friendNameCompact: {
    fontSize: 13,
    fontWeight: '500',
  },
  friendHandle: {
    fontFamily: THEME.fonts.regular,
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  statusText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    fontWeight: '500',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#0F172A',
  },
  playButtonDisabled: {
    backgroundColor: THEME.colors.surfaceContainerHigh,
    opacity: 0.7,
  },
  playButtonText: {
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowMenuBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.onSurface,
    textAlign: 'center',
  },
  removeDesc: {
    fontFamily: THEME.fonts.regular,
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 19,
  },
  removeActions: {
    gap: 8,
  },
  removeConfirm: {
    backgroundColor: THEME.colors.danger,
    borderRadius: THEME.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  removeConfirmText: {
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  removeCancel: {
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderRadius: THEME.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  removeCancelText: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  disabledAction: {
    opacity: 0.6,
  },
  emptyCard: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
  },
  emptyText: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  zeroFriendsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: 8,
  },
  zeroFriendsTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.onSurface,
    marginTop: 8,
  },
  zeroFriendsSub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    maxWidth: 240,
  },
  zeroAddBtn: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primary,
  },
  zeroAddBtnText: {
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.xl,
    padding: 20,
    maxWidth: 380,
    width: '100%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    ...THEME.shadows.modal,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: THEME.colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: THEME.colors.surfaceContainer,
    padding: 20,
    paddingBottom: 32,
    width: '100%',
    ...THEME.shadows.modal,
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  modalSearchBox: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    paddingHorizontal: 14,
    gap: 8,
  },
  modalSearchInput: {
    fontFamily: THEME.fonts.medium,
    flex: 1,
    fontSize: 14,
    color: THEME.colors.onSurface,
    ...NO_OUTLINE,
  },
  sheetAddBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: THEME.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetAddBtnDisabled: {
    opacity: 0.5,
  },
  sheetAddText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addFeedback: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    marginTop: 8,
  },
  ownIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.surfaceContainer,
  },
  ownIdLabel: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  ownIdValue: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.onSurface,
    marginTop: 2,
  },
  ownIdCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceContainerLow,
  },
  ownIdCopyText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  modalResultsScroll: {
    maxHeight: 220,
    marginTop: 4,
  },
  modalResultsContent: {
    gap: 2,
    paddingBottom: 4,
  },
  searchHint: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceContainerLow,
  },
  searchResultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchAvatarText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  searchUsername: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.onSurface,
  },
  searchHandle: {
    fontFamily: THEME.fonts.regular,
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  alreadyFriendsTag: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  sentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sentTagText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
  sendRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.boardBorder,
    backgroundColor: THEME.colors.surfaceContainerLow,
  },
  sendRequestBtnText: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
});
