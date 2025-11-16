        {/* Empty State */}
        {activeSessions.length === 0 && stats.totalCourses === 0 && (
          <div className="mt-8 bg-orange-50 border border-orange-200 rounded-2xl p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">🎓🐱</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {translate('dashboard_empty_title')}
              </h3>
              <p className="text-gray-600 mb-4">
                {translate('dashboard_empty_desc')}
              </p>
            </div>
          </div>
        )}
