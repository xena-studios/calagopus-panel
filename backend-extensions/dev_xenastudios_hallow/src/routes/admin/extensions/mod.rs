use shared::State;
use utoipa_axum::router::OpenApiRouter;

mod settings;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest(
            &format!("/{}/settings", crate::PACKAGE_NAME),
            settings::router(state),
        )
        .with_state(state.clone())
}
