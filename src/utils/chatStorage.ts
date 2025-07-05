export const saveChatThread = (threadId: string, messages: { sender: string; text: string }[]) => {
  try {
    localStorage.setItem(`chat-thread-${threadId}`, JSON.stringify(messages));
  } catch (error) {
    console.error("Failed to save chat thread:", error);
  }
};

export const retrieveChatThread = (threadId: string): { sender: string; text: string }[] => {
  try {
    const storedMessages = localStorage.getItem(`chat-thread-${threadId}`);
    return storedMessages ? JSON.parse(storedMessages) : [];
  } catch (error) {
    console.error("Failed to retrieve chat thread:", error);
    return [];
  }
};

export const clearChatThread = (threadId: string) => {
  try {
    localStorage.removeItem(`chat-thread-${threadId}`);
  } catch (error) {
    console.error("Failed to clear chat thread:", error);
  }
};

export const startNewConversation = (threadId: string) => {
  clearChatThread(threadId);
  return [{ sender: "agent", text: "Hello! How can I assist you today?" }];
};
