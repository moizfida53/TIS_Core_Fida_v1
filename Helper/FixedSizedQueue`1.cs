using System.Collections.Concurrent;

namespace TIS.Helpers
{
    /// <summary>
    /// A thread-safe queue that maintains a fixed maximum size by dequeuing oldest items when capacity is exceeded
    /// </summary>
    /// <typeparam name="T">The type of elements in the queue</typeparam>
    public class FixedSizedQueue<T> : ConcurrentQueue<T>
    {
        private readonly object _lock = new object();

        /// <summary>
        /// Gets the maximum size of the queue
        /// </summary>
        public int Size { get; private set; }

        /// <summary>
        /// Initializes a new instance of FixedSizedQueue with specified maximum size
        /// </summary>
        /// <param name="size">Maximum number of items the queue can hold</param>
        public FixedSizedQueue(int size)
        {
            Size = size;
        }

        /// <summary>
        /// Adds an item to the queue and removes oldest items if size exceeds maximum
        /// </summary>
        /// <param name="obj">The item to add</param>
        public new void Enqueue(T obj)
        {
            base.Enqueue(obj);

            lock (_lock)
            {
                while (Count > Size)
                {
                    TryDequeue(out _);
                }
            }
        }
    }
}